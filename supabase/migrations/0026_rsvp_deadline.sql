-- =============================================================================
-- 0026 — A real RSVP-by deadline on the wedding, so the couple can track who
-- hasn't replied and chase them (guests.responded_at already exists; the
-- submit_rsvp RPC stamps it).
-- =============================================================================

alter table weddings add column if not exists rsvp_deadline date;
