-- =============================================================================
-- 0023 — Disposable-camera TABLES. Each reception table gets its own QR code
-- (a token) and a shared "roll of film" (shot_limit). Scanning a table's QR
-- scopes the camera to that table and meters photos against its limit — this is
-- server-enforced (unlike the per-guest soft/localStorage limit), since the
-- table token is a real server entity. Photos taken via a table carry table_id.
-- =============================================================================

create table if not exists camera_tables (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  name       text not null,
  shot_limit int  not null default 30,
  token      text not null unique,           -- opaque, used in the QR URL (?t=)
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists camera_tables_wid_idx on camera_tables (wedding_id, sort);

alter table wedding_photos add column if not exists table_id uuid references camera_tables(id) on delete set null;
create index if not exists wedding_photos_table_idx on wedding_photos (table_id);

alter table camera_tables enable row level security;
do $$ begin
  begin
    create policy "members read camera_tables" on camera_tables for select using (is_wedding_member(wedding_id));
  exception when duplicate_object then null; end;
  begin
    create policy "editors write camera_tables" on camera_tables for all
      using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));
  exception when duplicate_object then null; end;
end $$;
