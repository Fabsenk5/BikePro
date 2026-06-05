-- ============================================
-- BikePro Incremental Migration — Add missing columns
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

-- Add max_clicks column to components table (used by component-tracker for suspension settings)
ALTER TABLE components ADD COLUMN IF NOT EXISTS max_clicks TEXT DEFAULT NULL;
