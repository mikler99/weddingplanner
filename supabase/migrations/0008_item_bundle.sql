-- =============================================================================
-- Package label on budget items. An all-inclusive package spans several
-- categories as separate named line items; `bundle` ties them together for a
-- "part of ‹package›" pill (and future select/remove-as-one). Free text = the
-- package name. NULL for ordinary standalone options.
-- =============================================================================
alter table budget_items add column if not exists bundle text;
