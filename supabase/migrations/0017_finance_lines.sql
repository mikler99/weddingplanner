-- =============================================================================
-- 0017 — Personal budgeting: itemized income + expense lines. Each line has a
-- pay frequency (normalized to monthly app-side) and an optional person (a
-- partner name, or null = shared/household). budget_config.monthly_income /
-- monthly_expenses / monthly stay as CACHED totals, recomputed on every change,
-- so computeBudget + the hub savings status keep working unchanged.
-- =============================================================================

create table if not exists finance_lines (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  kind text not null,                          -- 'income' | 'expense'
  label text not null default '',
  amount numeric not null default 0,
  frequency text not null default 'monthly',   -- 'monthly'|'weekly'|'biweekly'|'annual'
  person text,                                 -- partner name; null = shared/household
  category text,                               -- expense grouping (null for income)
  sort int not null default 0
);
create index if not exists finance_lines_wedding_idx on finance_lines (wedding_id, kind);

alter table finance_lines enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='finance_lines' and policyname='members read finance_lines') then
    create policy "members read finance_lines" on finance_lines for select using (is_wedding_member(wedding_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='finance_lines' and policyname='editors write finance_lines') then
    create policy "editors write finance_lines" on finance_lines for all
      using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));
  end if;
end $$;

-- Preserve any prior single-number income/expenses by seeding one line each.
insert into finance_lines (wedding_id, kind, label, amount, frequency, category)
select wedding_id, 'income', 'Income', monthly_income, 'monthly', null
from budget_config where coalesce(monthly_income, 0) > 0;

insert into finance_lines (wedding_id, kind, label, amount, frequency, category)
select wedding_id, 'expense', 'Living expenses', monthly_expenses, 'monthly', 'General'
from budget_config where coalesce(monthly_expenses, 0) > 0;
