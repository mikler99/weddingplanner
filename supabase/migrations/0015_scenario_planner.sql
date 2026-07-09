-- =============================================================================
-- 0015 — Payments + to-dos become scenario-owned (each plan has its own set),
-- and tasks gain a relative due-rule (like payments) for "6 months before" dates.
-- =============================================================================

alter table payments   add column if not exists scenario_id uuid references scenarios(id) on delete cascade;
alter table milestones add column if not exists scenario_id uuid references scenarios(id) on delete cascade;
alter table milestones add column if not exists due_rule jsonb;
create index if not exists payments_scenario_idx on payments(scenario_id);
create index if not exists milestones_scenario_idx on milestones(scenario_id);

-- Existing rows belong to the current active plan.
update payments p set scenario_id = s.id
  from scenarios s where s.wedding_id = p.wedding_id and s.is_active = true and p.scenario_id is null;
update milestones m set scenario_id = s.id
  from scenarios s where s.wedding_id = m.wedding_id and s.is_active = true and m.scenario_id is null;

-- Contract-payment idempotency is now per SCENARIO (two plans can each hold the
-- same contract's payments), so the uniqueness key includes scenario_id.
drop index if exists payments_source_uq;
create unique index payments_source_uq on payments (wedding_id, scenario_id, source_document_id, source_item_key)
  where source_document_id is not null;
