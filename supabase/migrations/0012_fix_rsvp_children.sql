-- =============================================================================
-- 0012 — Fix submit_rsvp inserting plus-one children.
-- The guests.invite_token DEFAULT calls gen_invite_token() → gen_random_bytes(),
-- which lives in the `extensions` schema. Under the definer function's
-- search_path=public it isn't found, so the child insert (and the whole tx)
-- errored out. Fix: widen the search_path AND give children an explicit token via
-- the built-in gen_random_uuid() (no extension needed).
-- =============================================================================

create or replace function submit_rsvp(
  p_token text, p_rsvp text, p_attending int,
  p_additional jsonb default '[]', p_dietary text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
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
    insert into guests (wedding_id, name, invite_token, parent_id, side, max_seats, invited, rsvp, attending_count)
    select wid, trim(v), gen_random_uuid()::text, gid, gside, 1, true, 'yes', 1
    from jsonb_array_elements_text(p_additional) as v
    where trim(v) <> '';
  end if;
end $$;
revoke all on function submit_rsvp(text,text,int,jsonb,text) from public;
grant execute on function submit_rsvp(text,text,int,jsonb,text) to anon, authenticated;
