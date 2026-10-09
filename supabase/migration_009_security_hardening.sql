-- ============================================
-- Migration 009: Security & cleanup hardening
-- - Admin RPCs: revoke default PUBLIC/anon execute; keep authenticated + service_role
--   (the functions still enforce is_admin() internally — defense in depth)
-- - wiki_overrides.id: gen_random_uuid() (core) instead of uuid_generate_v4(),
--   so fresh setups no longer depend on the uuid-ossp extension
-- - Drop unused legacy park_status table (scraper experiment, replaced by the
--   curated bikeparks dataset; verified empty and backed up before drop)
-- ============================================

REVOKE EXECUTE ON FUNCTION public.admin_get_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_status(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_password(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(UUID, TEXT) TO authenticated, service_role;

ALTER TABLE public.wiki_overrides ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP TABLE IF EXISTS public.park_status;
