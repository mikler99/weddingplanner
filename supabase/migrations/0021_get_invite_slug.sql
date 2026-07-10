-- =============================================================================
-- 0021 — get_invite also returns the wedding slug, so a guest's personal link
-- /i/<token> can set a guest cookie and redirect into the public site /w/<slug>.
-- Return-type change → drop + recreate.
-- =============================================================================

drop function if exists get_invite(text);
create or replace function get_invite(p_token text)
returns table (name text, max_seats int, rsvp text, attending_count int,
               additional_names jsonb, meal jsonb, dietary text,
               event_date date, venue_name text, invite_config jsonb, slug text)
language sql security definer set search_path = public as $$
  select g.name, g.max_seats, g.rsvp, g.attending_count, g.additional_names, g.meal,
         g.dietary, w.event_date, w.venue_name, w.invite_config, w.slug
  from guests g join weddings w on w.id = g.wedding_id
  where g.invite_token = p_token
$$;
revoke all on function get_invite(text) from public;
grant execute on function get_invite(text) to anon, authenticated;
