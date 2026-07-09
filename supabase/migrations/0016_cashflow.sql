-- =============================================================================
-- 0016 — Cash-flow inputs: monthly income + living expenses (savings capacity),
-- and an optional expected date for one-off contributions (gifts).
-- =============================================================================

alter table budget_config add column if not exists monthly_income   numeric not null default 0;
alter table budget_config add column if not exists monthly_expenses numeric not null default 0;

-- When a contribution is expected (null = treat as arriving at the wedding).
alter table gifts add column if not exists on_date date;
