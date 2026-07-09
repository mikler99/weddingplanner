-- =============================================================================
-- Payment timing as a RULE, not a fixed date. Contracts state due dates
-- relative to the wedding ("25% due 12 months prior", "with signed contract"),
-- so we store the rule and derive the actual date from the wedding's event_date
-- at render — if the date moves, every payment shifts with it.
-- `due_date` remains an optional absolute override (explicit calendar date).
-- =============================================================================
alter table payments add column if not exists due_rule jsonb;
