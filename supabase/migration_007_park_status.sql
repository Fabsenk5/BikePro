-- ============================================
-- Park-Picker: Scraped lift status (daily GitHub Actions job)
-- Public read (all users see the same status), write via service role only.
-- ============================================

CREATE TABLE IF NOT EXISTS park_status (
    park_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'unknown',  -- open | partial | closed | season_end | unknown
    note TEXT DEFAULT '',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE park_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Park status is public read" ON park_status;
CREATE POLICY "Park status is public read" ON park_status
    FOR SELECT USING (true);

DROP TRIGGER IF EXISTS park_status_updated_at ON park_status;
CREATE OR REPLACE TRIGGER park_status_updated_at BEFORE UPDATE ON park_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
