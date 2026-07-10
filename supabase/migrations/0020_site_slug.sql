-- =============================================================================
-- 0020 — Public wedding-site slug + anonymous read. The website lives at
-- /w/<slug> and is public; weddings is member-read only, so anon reads go
-- through a SECURITY DEFINER RPC (mirrors get_invite). No guest data is exposed.
-- =============================================================================

alter table weddings add column if not exists slug text;

-- Backfill a slug from the wedding name (few rows; collisions handled by suffix).
update weddings set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null and name is not null;

-- De-dup any collisions by appending a short id fragment.
update weddings w set slug = w.slug || '-' || left(w.id::text, 4)
from (select slug from weddings where slug is not null group by slug having count(*) > 1) dup
where w.slug = dup.slug;

create unique index if not exists weddings_slug_uq on weddings (slug) where slug is not null;

create or replace function get_site_by_slug(p_slug text)
returns table (wedding_id uuid, name text, event_date date, venue_name text, invite_config jsonb)
language sql security definer set search_path = public as $$
  select id, name, event_date, venue_name, invite_config from weddings where slug = p_slug
$$;
revoke all on function get_site_by_slug(text) from public;
grant execute on function get_site_by_slug(text) to anon, authenticated;
