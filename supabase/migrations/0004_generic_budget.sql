-- =============================================================================
-- Generic budget model — replaces venue_costs / caterers / budget_lines and the
-- bar/tableware/delivery/rentals config knobs with ONE data-driven table. No
-- venue, caterer, bar package, or province is special-cased anymore.
-- Old tables are left in place (unused) so nothing breaks mid-migration.
-- =============================================================================
create table budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  category text not null default 'Other',
  label text not null,
  cost_type text not null default 'flat',      -- 'flat' | 'per_guest'
  amount numeric not null default 0,           -- flat cost, or per-guest rate
  taxable boolean not null default true,
  service_pct numeric not null default 0,      -- on-top charge (e.g. 18 bar gratuity), untaxed
  refundable boolean not null default false,   -- surfaced but excluded from expense
  active boolean not null default true,
  group_key text,                              -- mutually-exclusive options (e.g. 'caterer')
  vendor_id uuid references vendors(id) on delete set null,
  source_document_id uuid references documents(id) on delete set null,  -- provenance
  source_item_key text,
  sort int not null default 0
);
create unique index budget_items_source_uq on budget_items (wedding_id, source_document_id, source_item_key)
  where source_document_id is not null;

-- Per-wedding tax rate (region-driven default; editable). saved/monthly stay.
alter table budget_config add column if not exists tax_rate numeric not null default 0.13;

-- RLS: member read, editor write (same pattern as every wedding-scoped table).
alter table budget_items enable row level security;
create policy "members read budget_items" on budget_items for select using (is_wedding_member(wedding_id));
create policy "editors write budget_items" on budget_items for all
  using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));

-- Realtime (same as the other budget tables).
do $$ begin
  begin alter publication supabase_realtime add table budget_items; exception when others then null; end;
  execute 'alter table budget_items replica identity full';
end $$;

-- ---------------------------------------------------------------------------
-- Data migration: fold each wedding's existing rows into budget_items. Runs
-- only for weddings that have none yet, so it's safe to re-run.
-- ---------------------------------------------------------------------------
do $$
declare w record;
begin
  for w in select id from weddings loop
    if exists (select 1 from budget_items where wedding_id = w.id) then continue; end if;

    -- Venue fixed line items -> Venue (flat, taxable)
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, sort, source_document_id, source_item_key)
      select wedding_id, 'Venue', label, 'flat', amount, true, sort, source_document_id, source_item_key
      from venue_costs where wedding_id = w.id;

    -- Caterer options -> Catering (per_guest, grouped; only the selected one active)
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, active, group_key, sort, source_document_id, source_item_key)
      select wedding_id, 'Catering', coalesce(nullif(package,''), name, 'Caterer'), 'per_guest', price_pp, true, is_selected, 'caterer', sort, source_document_id, source_item_key
      from caterers where wedding_id = w.id;

    -- Everything-else lines -> Other (flat, untaxed to match the original model)
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, sort, source_document_id, source_item_key)
      select wedding_id, 'Other', label, 'flat', amount, false, sort, source_document_id, source_item_key
      from budget_lines where wedding_id = w.id;

    -- Config-derived lines (bar + its 18% service, tableware, delivery, rentals untaxed)
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, service_pct, sort)
      select wedding_id, 'Bar', 'Bar (per guest)', 'per_guest', bar_rate, true, 18, 90 from budget_config where wedding_id = w.id;
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, sort)
      select wedding_id, 'Catering', 'Tableware', 'per_guest', tableware_pp, true, 91 from budget_config where wedding_id = w.id;
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, sort)
      select wedding_id, 'Catering', 'Delivery', 'flat', delivery, true, 92 from budget_config where wedding_id = w.id;
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, sort)
      select wedding_id, 'Catering', 'Rentals', 'flat', rentals, false, 93 from budget_config where wedding_id = w.id;

    -- Refundable damage hold (surfaced, excluded from expense)
    insert into budget_items (wedding_id, category, label, cost_type, amount, taxable, refundable, sort)
      values (w.id, 'Venue', 'Damage hold (refundable)', 'flat', 1000, false, true, 94);
  end loop;
end $$;
