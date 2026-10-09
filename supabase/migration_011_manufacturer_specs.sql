-- ============================================
-- Migration 011: manufacturer recommendation table per component
-- Fork/shock components can carry the manufacturer's weight/setting table,
-- maintained inline in the Component Tracker. All values optional; click
-- values may be ranges as printed in the manual ("5-6").
-- ============================================

ALTER TABLE components ADD COLUMN IF NOT EXISTS spec_table JSONB DEFAULT NULL;
ALTER TABLE components ADD COLUMN IF NOT EXISTS spec_source TEXT DEFAULT NULL;
