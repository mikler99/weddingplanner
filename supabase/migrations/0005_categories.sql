-- =============================================================================
-- First-class budget categories — the tabs/cards of the planning hub. Each has
-- a colour, slug (for /budget/<slug>), and sort order. Categories exist
-- independently of items, so a "not started" category (e.g. Photography) can
-- still show a card and be a target to add into. Items link by category NAME
-- (budget_items.category), which stays the source of truth for the engine.
-- =============================================================================
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#7A8290',
  sort int not null default 50
);
create unique index budget_categories_name_uq on budget_categories (wedding_id, name);
create unique index budget_categories_slug_uq on budget_categories (wedding_id, slug);

alter table budget_categories enable row level security;
create policy "members read budget_categories" on budget_categories for select using (is_wedding_member(wedding_id));
create policy "editors write budget_categories" on budget_categories for all
  using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));

do $$ begin
  begin alter publication supabase_realtime add table budget_categories; exception when others then null; end;
  execute 'alter table budget_categories replica identity full';
end $$;

-- Seed a sensible default set + every category the wedding's items already use.
do $$
declare w record; nm text;
  defaults text[] := array['Venue','Ceremony venue','Catering','Bar','Florals','Photography','Attire','Music','Other'];
begin
  for w in select id from weddings loop
    for nm in
      select distinct category from budget_items where wedding_id = w.id
      union select unnest(defaults)
    loop
      insert into budget_categories (wedding_id, name, slug, color, sort)
      values (
        w.id, nm,
        trim(both '-' from regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g')),
        case nm
          when 'Venue' then '#4F52C4' when 'Reception venue' then '#4F52C4' when 'Ceremony venue' then '#D6567F'
          when 'Catering' then '#E08A2B' when 'Bar' then '#1E9E96' when 'Florals' then '#4C9A52'
          when 'Photography' then '#8A5CD1' when 'Attire' then '#D45AA8' when 'Music' then '#3E86D4'
          when 'Other' then '#7A8290' else '#7A8290' end,
        case nm
          when 'Venue' then 0 when 'Reception venue' then 0 when 'Ceremony venue' then 1 when 'Catering' then 2
          when 'Bar' then 3 when 'Florals' then 4 when 'Photography' then 5 when 'Attire' then 6
          when 'Music' then 7 when 'Other' then 90 else 50 end
      )
      on conflict (wedding_id, name) do nothing;
    end loop;
  end loop;
end $$;
