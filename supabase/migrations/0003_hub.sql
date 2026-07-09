-- =============================================================================
-- Hub groundwork — generic fields the dashboard (and later the cash-flow engine
-- and region-based tax rules) hang on. Nothing venue-specific.
-- =============================================================================
alter table weddings add column if not exists budget_target numeric;      -- overall target, nullable until set
alter table weddings add column if not exists region text default 'ON';    -- drives tax rules later
