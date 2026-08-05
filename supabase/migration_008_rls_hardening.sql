-- ============================================
-- RLS hardening
-- Fixes tables created without Row-Level Security
-- (Supabase Security Advisor: rls_disabled_in_public).
-- ============================================

-- schema_migrations is internal bookkeeping (run_migration.js).
-- Enable RLS with NO policies → anon/authenticated get zero access,
-- only the service role (bypasses RLS) can read/write it.
ALTER TABLE IF EXISTS schema_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schema_migrations_public" ON schema_migrations;

-- Defensive: re-enable RLS on every app table (idempotent, no-ops when already on).
ALTER TABLE IF EXISTS bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suspension_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wiki_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS park_status ENABLE ROW LEVEL SECURITY;

-- park_status is public-READ only: strip any write policies that may exist
-- (scraper writes via service role, which bypasses RLS).
DROP POLICY IF EXISTS "Park status is public insert" ON park_status;
DROP POLICY IF EXISTS "Park status is public update" ON park_status;
DROP POLICY IF EXISTS "Park status is public delete" ON park_status;

-- Diagnostic: list any remaining table in public without RLS.
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND NOT rowsecurity
    LOOP
        RAISE WARNING 'RLS still disabled on public.%', t;
    END LOOP;
END $$;
