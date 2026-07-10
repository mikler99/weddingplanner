-- =============================================================================
-- 0022 — Wedding-day app: shared "disposable camera" gallery, guestbook, and
-- song requests. These are filled in by GUESTS, who are anonymous — so writes
-- happen server-side through the service-role admin client after a slug→wedding
-- validation (mirrors the member-invite pattern). RLS below is for the couple:
-- members read, editors moderate/delete from the dashboard.
-- =============================================================================

-- Public bucket for guest photos: <wedding_id>/<uuid>.<ext>. Public read so the
-- live gallery renders for anyone with the link; writes go through the admin
-- client (service role), so no anon insert policy is needed.
insert into storage.buckets (id, name, public) values ('wedding-photos', 'wedding-photos', true)
on conflict (id) do nothing;

do $$ begin
  begin
    create policy "public read wedding photos" on storage.objects for select
      using (bucket_id = 'wedding-photos');
  exception when duplicate_object then null; end;
  begin
    create policy "editors delete wedding photos" on storage.objects for delete
      using (bucket_id = 'wedding-photos' and is_wedding_editor((storage.foldername(name))[1]::uuid));
  exception when duplicate_object then null; end;
end $$;

create table if not exists wedding_photos (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references weddings(id) on delete cascade,
  storage_path text not null,
  uploader_name text,
  caption      text,
  prompt       text,          -- the scavenger-hunt prompt this photo answers, if any
  hidden       boolean not null default false,  -- couple can hide without deleting
  created_at   timestamptz not null default now()
);
create index if not exists wedding_photos_wid_idx on wedding_photos (wedding_id, created_at desc);

create table if not exists guestbook_entries (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  name       text not null,
  message    text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists guestbook_wid_idx on guestbook_entries (wedding_id, created_at desc);

create table if not exists song_requests (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references weddings(id) on delete cascade,
  title        text not null,
  artist       text,
  requested_by text,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists song_requests_wid_idx on song_requests (wedding_id, created_at desc);

alter table wedding_photos    enable row level security;
alter table guestbook_entries enable row level security;
alter table song_requests     enable row level security;

do $$ begin
  begin
    create policy "members read wedding_photos" on wedding_photos for select using (is_wedding_member(wedding_id));
  exception when duplicate_object then null; end;
  begin
    create policy "editors write wedding_photos" on wedding_photos for all
      using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));
  exception when duplicate_object then null; end;

  begin
    create policy "members read guestbook" on guestbook_entries for select using (is_wedding_member(wedding_id));
  exception when duplicate_object then null; end;
  begin
    create policy "editors write guestbook" on guestbook_entries for all
      using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));
  exception when duplicate_object then null; end;

  begin
    create policy "members read song_requests" on song_requests for select using (is_wedding_member(wedding_id));
  exception when duplicate_object then null; end;
  begin
    create policy "editors write song_requests" on song_requests for all
      using (is_wedding_editor(wedding_id)) with check (is_wedding_editor(wedding_id));
  exception when duplicate_object then null; end;
end $$;
