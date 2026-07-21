-- =============================================================================
-- 0027 — Plaid bank connection (one per wedding). The access token is stored
-- ENCRYPTED (AES-256-GCM, app-level, key in server env) — never plaintext,
-- never sent to the client. RLS lets members SEE the connection (institution +
-- last synced balance) but the token column is ciphertext, and all Plaid calls
-- happen server-side via the service-role client. Bank credentials never touch
-- our servers at all (Plaid Link handles login in its own iframe).
-- =============================================================================

create table if not exists plaid_items (
  id                 uuid primary key default gen_random_uuid(),
  wedding_id         uuid not null references weddings(id) on delete cascade,
  item_id            text not null,
  access_token_enc   text not null,          -- AES-GCM: iv:tag:ciphertext (base64)
  institution_name   text,
  last_balance       numeric,                -- cached synced total (non-sensitive)
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now()
);
create unique index if not exists plaid_items_wedding_uq on plaid_items (wedding_id);

alter table plaid_items enable row level security;
do $$ begin
  -- Members can see that a bank is linked + the cached balance; the token is
  -- ciphertext and useless without the server-only key. Writes go through the
  -- service-role client in server actions (no client insert/update policy).
  begin
    create policy "members read plaid_items" on plaid_items for select using (is_wedding_member(wedding_id));
  exception when duplicate_object then null; end;
end $$;
