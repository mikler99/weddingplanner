-- =============================================================================
-- 0019 — Per-member module access. null = all modules (default). A non-null
-- array limits which modules (pages) a member sees + can navigate to.
-- Soft enforcement (nav filter + route redirect); RLS still blocks viewer writes.
-- =============================================================================

alter table wedding_members add column if not exists allowed_modules text[];
