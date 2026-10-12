-- ============================================
-- Migration 012: Geometry & Fit data per bike
-- Frame specs, cockpit, fit values and tape measurements as one JSONB blob
-- on the bike row (rides the existing bike sync).
-- ============================================

ALTER TABLE bikes ADD COLUMN IF NOT EXISTS geometry JSONB DEFAULT NULL;
