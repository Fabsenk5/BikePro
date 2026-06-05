-- ============================================
-- BikePro Incremental Migration — Add missing columns
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

-- Add weight column to bikes table (used by component-tracker for bike weight in kg)
ALTER TABLE bikes ADD COLUMN IF NOT EXISTS weight REAL DEFAULT NULL;

-- Add price column to components table (used by component-tracker for part prices)
ALTER TABLE components ADD COLUMN IF NOT EXISTS price TEXT DEFAULT '';
