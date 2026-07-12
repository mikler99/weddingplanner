-- =============================================================================
-- 0025 — Carry module access on the invite, so an owner picks what a person can
-- see up front. Applied to wedding_members on accept/claim. null = all modules.
-- =============================================================================

alter table member_invites add column if not exists allowed_modules text[];
