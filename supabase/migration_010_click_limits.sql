-- ============================================
-- Migration 010: per-channel click limits for fork/shock
-- Stores channel-specific max clicks (rebound, reboundHsr, reboundLsr,
-- compression, compressionHsc, compressionLsc) as JSONB. The legacy
-- max_clicks value remains as fallback for channels without a specific value.
-- ============================================

ALTER TABLE components ADD COLUMN IF NOT EXISTS click_limits JSONB DEFAULT NULL;
