-- =============================================================================
-- 0014 — Promote "vendor" from free text to a first-class entity, and link
-- options / documents / payments / tasks to it. Vendors become the supplier CRM;
-- scenarios stay the cost-mixing layer. Payments/tasks can then follow the plan
-- via the vendors a scenario actually uses.
-- =============================================================================

-- Extend the (previously dead) vendors table with contact/notes fields.
alter table vendors add column if not exists email text;
alter table vendors add column if not exists phone text;
alter table vendors add column if not exists website text;
alter table vendors add column if not exists notes text;

-- Link everything to a vendor (nullable = "no supplier / general").
alter table budget_items add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table documents    add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table payments     add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table milestones   add column if not exists vendor_id uuid references vendors(id) on delete set null;
create index if not exists budget_items_vendor_idx on budget_items(vendor_id);
create index if not exists payments_vendor_idx on payments(vendor_id);
create index if not exists milestones_vendor_idx on milestones(vendor_id);

-- Clean slate: the existing vendors rows were seed-only and never surfaced in the
-- app (no vendors UI existed), and their names don't match the live option/doc
-- vendors. Rebuild from the authoritative sources instead of fuzzy-matching.
delete from vendors;

-- One vendor per distinct supplier name, sourced from option vendor text + doc
-- vendor_name. Representative category = a category one of their options uses.
insert into vendors (wedding_id, name, category, status, sort)
select wedding_id, name, min(category) as category, 'Considering', 0
from (
  select wedding_id, btrim(vendor) as name, category from budget_items where vendor is not null and btrim(vendor) <> ''
  union all
  select wedding_id, btrim(vendor_name) as name, null::text from documents where vendor_name is not null and btrim(vendor_name) <> ''
) s
group by wedding_id, name;

create unique index if not exists vendors_wedding_name_uq on vendors (wedding_id, lower(name)) where name is not null;

-- Link options + documents by exact name; payments inherit from their contract doc.
update budget_items b set vendor_id = v.id
  from vendors v where v.wedding_id = b.wedding_id and lower(v.name) = lower(btrim(b.vendor)) and b.vendor_id is null;
update documents d set vendor_id = v.id
  from vendors v where v.wedding_id = d.wedding_id and lower(v.name) = lower(btrim(d.vendor_name)) and d.vendor_id is null;
update payments p set vendor_id = d.vendor_id
  from documents d where d.id = p.source_document_id and d.vendor_id is not null and p.vendor_id is null;
