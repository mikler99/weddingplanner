-- =============================================================================
-- Wedding Planning Hub — initial schema, RLS, storage, invite RPCs
-- Everything is scoped to wedding_id; access via wedding_members.
-- =============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid, gen_random_bytes

-- -----------------------------------------------------------------------------
-- Core
-- -----------------------------------------------------------------------------
create table weddings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Wedding',
  event_date date not null,
  venue_name text,
  venue_address text,
  guest_estimate int not null default 80,
  guest_guarantee int not null default 70,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table wedding_members (
  wedding_id uuid references weddings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'editor',   -- 'owner' | 'editor' | 'viewer'
  primary key (wedding_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Membership helpers — SECURITY DEFINER so policies on wedding_members do NOT
-- recurse into their own RLS. Every policy below calls these.
-- -----------------------------------------------------------------------------
create or replace function is_wedding_member(wid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from wedding_members m
    where m.wedding_id = wid and m.user_id = auth.uid()
  )
$$;

create or replace function is_wedding_editor(wid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from wedding_members m
    where m.wedding_id = wid and m.user_id = auth.uid()
      and m.role in ('owner','editor')
  )
$$;

-- -----------------------------------------------------------------------------
-- Budget config: single row of assumptions driving computed costs
-- -----------------------------------------------------------------------------
create table budget_config (
  wedding_id uuid primary key references weddings(id) on delete cascade,
  bar_rate numeric not null default 55,     -- 55 beer/wine, 65 full bar
  tableware_pp numeric not null default 2,
  delivery numeric not null default 250,
  rentals numeric not null default 200,
  saved numeric not null default 0,         -- savings plan: banked today
  monthly numeric not null default 0        -- savings plan: $/month
);

-- -----------------------------------------------------------------------------
-- Venue/bar fixed line items (seeded from the Quayle's contract; editable)
-- -----------------------------------------------------------------------------
create table venue_costs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  label text not null,
  amount numeric not null,
  sort int not null default 0,
  source_document_id uuid,                               -- provenance (fk added below)
  source_item_key text                                   -- stable key for idempotent re-Apply
);

-- Caterer options; exactly one selected drives the catering cost
create table caterers (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text,
  package text,
  price_pp numeric not null default 0,
  is_selected boolean not null default false,
  sort int not null default 0,
  source_document_id uuid,                               -- provenance (fk added below)
  source_item_key text
);

-- "Everything else" budget lines (florals, attire, photo, contingency, ...)
create table budget_lines (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  sort int not null default 0,
  source_document_id uuid,                               -- provenance (fk added below)
  source_item_key text
);

-- Funding: gifts / one-time contributions (added to the savings plan)
create table gifts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  sort int not null default 0
);

-- Timeline / checklist
create table milestones (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  when_label text not null,     -- e.g. 'Jul 2027 (30 days)'
  due_date date,                -- optional real date for sorting/reminders
  task text not null,
  owner text,
  done boolean not null default false,
  sort int not null default 0
);

-- Vendors comparison
create table vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  category text,
  name text,
  contact text,
  quote numeric default 0,
  status text default 'Open',   -- Open | Quoting | Tentative | Booked
  next_step text,
  sort int not null default 0
);

-- Documents / links + uploaded files (Section 9 columns folded in)
create table documents (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  label text not null,
  url text,
  sort int not null default 0,
  storage_path text,
  mime text,
  kind text default 'other',    -- quote | contract | menu | other
  vendor_name text,
  extracted boolean default false
);

-- Now that documents exists, wire up the provenance FKs deferred above.
alter table venue_costs  add constraint venue_costs_source_fk
  foreign key (source_document_id) references documents(id) on delete set null;
alter table caterers     add constraint caterers_source_fk
  foreign key (source_document_id) references documents(id) on delete set null;
alter table budget_lines add constraint budget_lines_source_fk
  foreign key (source_document_id) references documents(id) on delete set null;

-- Stable-key upsert targets for idempotent re-Apply (flag #2)
create unique index venue_costs_source_uq  on venue_costs  (wedding_id, source_document_id, source_item_key) where source_document_id is not null;
create unique index caterers_source_uq     on caterers     (wedding_id, source_document_id, source_item_key) where source_document_id is not null;
create unique index budget_lines_source_uq on budget_lines (wedding_id, source_document_id, source_item_key) where source_document_id is not null;

-- AI extraction staging: proposals only, never authoritative until Apply
create table document_extractions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  model text,
  data jsonb not null,                       -- structured proposal
  status text not null default 'draft',      -- draft | applied | discarded
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Guests / RSVP + tokenized public invitation
-- -----------------------------------------------------------------------------
-- URL-safe token generator (defined before guests so it can be the default)
create or replace function gen_invite_token() returns text language sql as $$
  select replace(replace(encode(gen_random_bytes(9),'base64'),'/','_'),'+','-')
$$;

create table guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text not null,
  invite_token text unique not null default gen_invite_token(),
  max_seats int not null default 1,   -- COUPLE-CONTROLLED cap
  address text,
  invited boolean default false,
  rsvp text default 'pending',        -- pending | yes | no
  attending_count int,                -- guest response, capped <= max_seats server-side
  additional_names jsonb default '[]',
  meal jsonb default '{}',
  dietary text,
  side text,                          -- Michael | Olivia | Both
  responded_at timestamptz,
  sort int not null default 0
);

-- Payment schedule (Quayle's installments etc.)
create table payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  label text not null,
  due_date date,
  amount numeric not null default 0,
  paid boolean not null default false,
  sort int not null default 0,
  source_document_id uuid references documents(id) on delete set null,
  source_item_key text
);
create unique index payments_source_uq on payments (wedding_id, source_document_id, source_item_key) where source_document_id is not null;

-- =============================================================================
-- Row Level Security — enable on every wedding-scoped table.
-- Read = member; write = editor/owner. Members read/write via helper fns.
-- guests has member policies for the authed admin app, but NO anon policy —
-- the public invite reaches exactly one row only through the RPCs below.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'weddings','wedding_members','budget_config','venue_costs','caterers',
    'budget_lines','gifts','milestones','vendors','documents',
    'document_extractions','guests','payments'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- weddings: keyed on own id
create policy "members read weddings"  on weddings for select using (is_wedding_member(id));
create policy "editors write weddings" on weddings for update using (is_wedding_editor(id)) with check (is_wedding_editor(id));

-- wedding_members: read own-wedding membership. Writes go through the
-- service-role key in a Server Action (invite/claim) — no client write policy.
create policy "members read members" on wedding_members for select using (is_wedding_member(wedding_id));

-- All other wedding-scoped tables share the same member-read / editor-write pattern.
do $$
declare t text;
begin
  foreach t in array array[
    'budget_config','venue_costs','caterers','budget_lines','gifts',
    'milestones','vendors','documents','document_extractions','guests','payments'
  ] loop
    execute format($f$
      create policy "members read %1$s" on %1$I for select
        using (is_wedding_member(wedding_id));
      create policy "editors write %1$s" on %1$I for all
        using (is_wedding_editor(wedding_id))
        with check (is_wedding_editor(wedding_id));
    $f$, t);
  end loop;
end $$;

-- =============================================================================
-- Storage: private `documents` bucket, locked to members, path-scoped by
-- wedding_id (objects stored as `<wedding_id>/<filename>`).
-- =============================================================================
insert into storage.buckets (id, name, public) values ('documents','documents', false)
  on conflict (id) do nothing;

create policy "members read doc files" on storage.objects for select
  using (bucket_id = 'documents' and is_wedding_member((storage.foldername(name))[1]::uuid));
create policy "editors write doc files" on storage.objects for insert
  with check (bucket_id = 'documents' and is_wedding_editor((storage.foldername(name))[1]::uuid));
create policy "editors update doc files" on storage.objects for update
  using (bucket_id = 'documents' and is_wedding_editor((storage.foldername(name))[1]::uuid));
create policy "editors delete doc files" on storage.objects for delete
  using (bucket_id = 'documents' and is_wedding_editor((storage.foldername(name))[1]::uuid));

-- =============================================================================
-- Public invitation RPCs — the ONLY anon path to a guests row.
-- SECURITY DEFINER, each touches exactly the one row matching the token.
-- Seat cap enforced server-side (flag: client tampering can't exceed max_seats).
-- =============================================================================
create or replace function get_invite(p_token text)
returns table (name text, max_seats int, rsvp text, attending_count int,
               additional_names jsonb, meal jsonb, event_date date, venue_name text)
language sql security definer set search_path = public as $$
  select g.name, g.max_seats, g.rsvp, g.attending_count, g.additional_names, g.meal,
         w.event_date, w.venue_name
  from guests g join weddings w on w.id = g.wedding_id
  where g.invite_token = p_token
$$;

create or replace function submit_rsvp(
  p_token text, p_rsvp text, p_attending int,
  p_additional jsonb default '[]', p_meal jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare cap int;
begin
  select max_seats into cap from guests where invite_token = p_token;
  if cap is null then raise exception 'invalid token'; end if;
  update guests set
    rsvp = case when p_rsvp in ('yes','no') then p_rsvp else 'pending' end,
    attending_count = least(greatest(coalesce(p_attending,0),0), cap),  -- hard cap
    additional_names = p_additional,
    meal = p_meal,
    responded_at = now()
  where invite_token = p_token;
end $$;

revoke all on function get_invite(text) from public;
revoke all on function submit_rsvp(text,text,int,jsonb,jsonb) from public;
grant execute on function get_invite(text) to anon;
grant execute on function submit_rsvp(text,text,int,jsonb,jsonb) to anon;
