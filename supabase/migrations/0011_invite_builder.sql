-- =============================================================================
-- 0011 — Invite builder + plus-ones-become-guests + email/mass-invite support.
-- =============================================================================

-- Guests: email (for sending invites) + parent_id (a plus-one belongs to the
-- guest who brought them; cascade so removing the host removes their party).
alter table guests add column if not exists email text;
alter table guests add column if not exists parent_id uuid references guests(id) on delete cascade;
create index if not exists guests_parent_idx on guests (parent_id);

-- Per-wedding invite page config authored by the visual builder (null = use the
-- app's built-in default design).
alter table weddings add column if not exists invite_config jsonb;

-- Public bucket for builder-uploaded invite photos (invite visitors are anon, so
-- these must be publicly readable). Path: <wedding_id>/<uuid>-<file>.
insert into storage.buckets (id, name, public) values ('invite-photos', 'invite-photos', true)
  on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='public read invite photos') then
    create policy "public read invite photos" on storage.objects for select
      using (bucket_id = 'invite-photos');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='editors write invite photos') then
    create policy "editors write invite photos" on storage.objects for insert
      with check (bucket_id = 'invite-photos' and is_wedding_editor((storage.foldername(name))[1]::uuid));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='editors update invite photos') then
    create policy "editors update invite photos" on storage.objects for update
      using (bucket_id = 'invite-photos' and is_wedding_editor((storage.foldername(name))[1]::uuid));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='editors delete invite photos') then
    create policy "editors delete invite photos" on storage.objects for delete
      using (bucket_id = 'invite-photos' and is_wedding_editor((storage.foldername(name))[1]::uuid));
  end if;
end $$;

-- submit_rsvp now also materializes each named plus-one as a guest row (parent_id
-- = the host), so the couple sees the whole party in their guest list. Re-run is
-- idempotent: the host's children are replaced each submit. attending_count on the
-- host still holds the head total, so children are excluded from tallies app-side.
create or replace function submit_rsvp(
  p_token text, p_rsvp text, p_attending int,
  p_additional jsonb default '[]', p_dietary text default null)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid; wid uuid; cap int; gside text;
begin
  select id, wedding_id, max_seats, side into gid, wid, cap, gside
    from guests where invite_token = p_token;
  if gid is null then raise exception 'invalid token'; end if;

  update guests set
    rsvp = case when p_rsvp in ('yes','no') then p_rsvp else 'pending' end,
    attending_count = least(greatest(coalesce(p_attending, 0), 0), cap),  -- hard seat cap
    additional_names = p_additional,
    dietary = p_dietary,
    responded_at = now()
  where id = gid;

  delete from guests where parent_id = gid;
  if p_rsvp = 'yes' then
    insert into guests (wedding_id, name, parent_id, side, max_seats, invited, rsvp, attending_count)
    select wid, trim(v), gid, gside, 1, true, 'yes', 1
    from jsonb_array_elements_text(p_additional) as v
    where trim(v) <> '';
  end if;
end $$;
revoke all on function submit_rsvp(text,text,int,jsonb,text) from public;
grant execute on function submit_rsvp(text,text,int,jsonb,text) to anon, authenticated;
