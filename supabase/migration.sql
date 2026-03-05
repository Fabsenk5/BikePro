-- ============================================
-- BikePro Supabase Migration
-- Creates all tables with Row-Level Security
-- ============================================

-- Enable RLS on all tables
-- Each user can only see/modify their own data

-- ─── BIKES ───
CREATE TABLE IF NOT EXISTS bikes (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'enduro',
    model TEXT DEFAULT '',
    year TEXT DEFAULT '2024',
    size TEXT DEFAULT 'L',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bikes" ON bikes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bikes" ON bikes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bikes" ON bikes
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bikes" ON bikes
    FOR DELETE USING (auth.uid() = user_id);

-- ─── COMPONENTS (belongs to a bike) ───
CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    bike_id TEXT NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'other',
    brand TEXT DEFAULT '',
    model TEXT DEFAULT '',
    weight TEXT DEFAULT '',
    purchase_date TEXT DEFAULT '',
    setup_values JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    is_wear_tracked BOOLEAN DEFAULT false,
    current_km INTEGER DEFAULT 0,
    service_interval_km INTEGER DEFAULT 500,
    last_service_date TEXT DEFAULT '',
    installed_date TEXT DEFAULT '',
    wear_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own components" ON components
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own components" ON components
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own components" ON components
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own components" ON components
    FOR DELETE USING (auth.uid() = user_id);

-- ─── SUSPENSION SETUPS (Dialed-In) ───
CREATE TABLE IF NOT EXISTS suspension_setups (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    location TEXT DEFAULT '',
    bike_id TEXT DEFAULT '',
    bike_name TEXT DEFAULT '',
    fork JSONB DEFAULT '{}'::jsonb,
    shock JSONB DEFAULT '{}'::jsonb,
    tires JSONB DEFAULT '{}'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suspension_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own setups" ON suspension_setups
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own setups" ON suspension_setups
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own setups" ON suspension_setups
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own setups" ON suspension_setups
    FOR DELETE USING (auth.uid() = user_id);

-- ─── RIDES (Ride-Log) ───
CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    park TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    distance TEXT DEFAULT '',
    descent_m TEXT DEFAULT '',
    max_speed TEXT DEFAULT '',
    bike_type TEXT DEFAULT '',
    conditions TEXT DEFAULT '',
    terrain TEXT DEFAULT '',
    mood TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rides" ON rides
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rides" ON rides
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rides" ON rides
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rides" ON rides
    FOR DELETE USING (auth.uid() = user_id);

-- ─── USER PREFERENCES (Favorites, Tile Order, Shred-Check, etc.) ───
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    key TEXT NOT NULL,
    value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prefs" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prefs" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prefs" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own prefs" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- ─── Updated-at trigger ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bikes_updated_at BEFORE UPDATE ON bikes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER suspension_setups_updated_at BEFORE UPDATE ON suspension_setups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
