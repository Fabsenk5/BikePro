-- ============================================
-- BikePro Incremental Migration — Add suspension modes
-- ============================================

ALTER TABLE components ADD COLUMN IF NOT EXISTS rebound_mode TEXT DEFAULT NULL;
ALTER TABLE components ADD COLUMN IF NOT EXISTS compression_mode TEXT DEFAULT NULL;
