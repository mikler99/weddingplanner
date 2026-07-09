-- =============================================================================
-- 0018 — Invite people (family/friends) to a wedding by email, with a role.
-- wedding_members has no client self-insert path (writes go through the
-- service-role key); invites work the same way. Members can READ their
-- wedding's pending invites; creation/acceptance happen via server actions
-- using the admin client.
-- =============================================================================

create table if not exists member_invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',        -- 'editor' | 'viewer'
  token text not null unique,                  -- set by the invite action
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);
create index if not exists member_invites_wedding_idx on member_invites (wedding_id);

alter table member_invites enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='member_invites' and policyname='members read member_invites') then
    create policy "members read member_invites" on member_invites for select using (is_wedding_member(wedding_id));
  end if;
end $$;
