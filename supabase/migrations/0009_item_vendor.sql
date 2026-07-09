-- =============================================================================
-- Supplier name on budget items, so comparisons make it obvious who each option
-- is from (e.g. "Triple Tailgate — Northbound BBQ" vs "Plated dinner — Smokehouse").
-- Free text, editable; auto-filled from the source quote on extraction.
-- Backfill existing doc-sourced options from their document's vendor.
-- =============================================================================
alter table budget_items add column if not exists vendor text;

update budget_items b
  set vendor = d.vendor_name
  from documents d
  where b.source_document_id = d.id and b.vendor is null and d.vendor_name is not null;
