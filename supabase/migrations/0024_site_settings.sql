-- =============================================================================
-- 0024 — Public-site settings: publish on/off + SEO / social-share preview.
-- get_site_by_slug is widened to return them so the public page can gate on
-- publish and emit metadata. Existing sites default to published = true.
-- =============================================================================

alter table weddings add column if not exists site_published  boolean not null default true;
alter table weddings add column if not exists seo_title        text;
alter table weddings add column if not exists seo_description  text;
alter table weddings add column if not exists seo_image        text;

drop function if exists get_site_by_slug(text);
create function get_site_by_slug(p_slug text)
returns table (wedding_id uuid, name text, event_date date, venue_name text, invite_config jsonb,
               site_published boolean, seo_title text, seo_description text, seo_image text)
language sql security definer set search_path = public as $$
  select id, name, event_date, venue_name, invite_config,
         site_published, seo_title, seo_description, seo_image
  from weddings where slug = p_slug
$$;
revoke all on function get_site_by_slug(text) from public;
grant execute on function get_site_by_slug(text) to anon, authenticated;
