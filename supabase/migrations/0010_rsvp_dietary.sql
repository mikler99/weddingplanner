-- =============================================================================
-- 0010 — RSVP wiring for the public invite (/i/[token]).
-- The couple's invite form collects a free-text dietary note; persist it to the
-- guests.dietary column (which the admin guest list reads) and return it from
-- get_invite so a returning guest sees their prior answer. Return type / arg
-- list change, so both functions are dropped and recreated (CREATE OR REPLACE
-- cannot alter a function's signature).
-- =============================================================================

drop function if exists get_invite(text);
create or replace function get_invite(p_token text)
returns table (name text, max_seats int, rsvp text, attending_count int,
               additional_names jsonb, meal jsonb, dietary text,
               event_date date, venue_name text)
language sql security definer set search_path = public as $$
  select g.name, g.max_seats, g.rsvp, g.attending_count, g.additional_names, g.meal,
         g.dietary, w.event_date, w.venue_name
  from guests g join weddings w on w.id = g.wedding_id
  where g.invite_token = p_token
$$;
revoke all on function get_invite(text) from public;
grant execute on function get_invite(text) to anon, authenticated;

drop function if exists submit_rsvp(text,text,int,jsonb,jsonb);
create or replace function submit_rsvp(
  p_token text, p_rsvp text, p_attending int,
  p_additional jsonb default '[]', p_dietary text default null)
returns void language plpgsql security definer set search_path = public as $$
declare cap int;
begin
  select max_seats into cap from guests where invite_token = p_token;
  if cap is null then raise exception 'invalid token'; end if;
  update guests set
    rsvp = case when p_rsvp in ('yes','no') then p_rsvp else 'pending' end,
    attending_count = least(greatest(coalesce(p_attending, 0), 0), cap),  -- hard seat cap
    additional_names = p_additional,
    dietary = p_dietary,
    responded_at = now()
  where invite_token = p_token;
end $$;
revoke all on function submit_rsvp(text,text,int,jsonb,text) from public;
grant execute on function submit_rsvp(text,text,int,jsonb,text) to anon, authenticated;
