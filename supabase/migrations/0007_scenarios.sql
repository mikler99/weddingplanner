-- =============================================================================
-- Scenarios — named "mixes" you compare without committing. budget_items is now
-- a POOL of candidate options; a scenario SELECTS which options it includes
-- (scenario_items). Exactly one scenario per wedding is active ("the plan") and
-- drives the budget/hub/payments. Non-active scenarios are what-ifs and may
-- carry their own comparison guest count; the active plan uses the wedding's.
-- =============================================================================
create table scenarios (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text not null default 'Scenario',
  guests int not null default 80,      -- comparison headcount for this mix
  is_active boolean not null default false,
  sort int not null default 0,
  created_at timestamptz default now()
);
create unique index scenarios_one_active on scenarios (wedding_id) where is_active;

create table scenario_items (
  scenario_id uuid references scenarios(id) on delete cascade,
  item_id uuid references budget_items(id) on delete cascade,
  primary key (scenario_id, item_id)
);

alter table scenarios enable row level security;
create policy "members read scenarios" on scenarios for select using (is_wedding_member(wedding_id));
create policy "editors write scenarios" on scenarios for all
  using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));

alter table scenario_items enable row level security;
create policy "members read scenario_items" on scenario_items for select
  using (exists (select 1 from scenarios s where s.id = scenario_id and is_wedding_member(s.wedding_id)));
create policy "editors write scenario_items" on scenario_items for all
  using (exists (select 1 from scenarios s where s.id = scenario_id and is_wedding_editor(s.wedding_id)))
  with check (exists (select 1 from scenarios s where s.id = scenario_id and is_wedding_editor(s.wedding_id)));

do $$ begin
  begin alter publication supabase_realtime add table scenarios; exception when others then null; end;
  begin alter publication supabase_realtime add table scenario_items; exception when others then null; end;
  execute 'alter table scenarios replica identity full';
  execute 'alter table scenario_items replica identity full';
end $$;

-- Each existing wedding's current budget (its active budget_items) becomes a
-- "Working plan" scenario, active.
do $$
declare w record; sid uuid;
begin
  for w in select id, guest_estimate from weddings loop
    if exists (select 1 from scenarios where wedding_id = w.id) then continue; end if;
    insert into scenarios (wedding_id, name, guests, is_active, sort)
      values (w.id, 'Working plan', coalesce(w.guest_estimate, 80), true, 0)
      returning id into sid;
    insert into scenario_items (scenario_id, item_id)
      select sid, id from budget_items where wedding_id = w.id and active = true;
  end loop;
end $$;
