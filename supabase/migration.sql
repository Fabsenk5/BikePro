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

DROP POLICY IF EXISTS "Users can view own bikes" ON bikes; CREATE POLICY "Users can view own bikes" ON bikes
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own bikes" ON bikes; CREATE POLICY "Users can insert own bikes" ON bikes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own bikes" ON bikes; CREATE POLICY "Users can update own bikes" ON bikes
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bikes" ON bikes; CREATE POLICY "Users can delete own bikes" ON bikes
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

DROP POLICY IF EXISTS "Users can view own components" ON components; CREATE POLICY "Users can view own components" ON components
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own components" ON components; CREATE POLICY "Users can insert own components" ON components
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own components" ON components; CREATE POLICY "Users can update own components" ON components
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own components" ON components; CREATE POLICY "Users can delete own components" ON components
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

DROP POLICY IF EXISTS "Users can view own setups" ON suspension_setups; CREATE POLICY "Users can view own setups" ON suspension_setups
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own setups" ON suspension_setups; CREATE POLICY "Users can insert own setups" ON suspension_setups
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own setups" ON suspension_setups; CREATE POLICY "Users can update own setups" ON suspension_setups
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own setups" ON suspension_setups; CREATE POLICY "Users can delete own setups" ON suspension_setups
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

DROP POLICY IF EXISTS "Users can view own rides" ON rides; CREATE POLICY "Users can view own rides" ON rides
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own rides" ON rides; CREATE POLICY "Users can insert own rides" ON rides
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own rides" ON rides; CREATE POLICY "Users can update own rides" ON rides
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own rides" ON rides; CREATE POLICY "Users can delete own rides" ON rides
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

DROP POLICY IF EXISTS "Users can view own prefs" ON user_preferences; CREATE POLICY "Users can view own prefs" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own prefs" ON user_preferences; CREATE POLICY "Users can insert own prefs" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own prefs" ON user_preferences; CREATE POLICY "Users can update own prefs" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own prefs" ON user_preferences; CREATE POLICY "Users can delete own prefs" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- ─── Updated-at trigger ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER bikes_updated_at BEFORE UPDATE ON bikes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER suspension_setups_updated_at BEFORE UPDATE ON suspension_setups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Profile & Admin Management Validation
-- ============================================

-- ─── PROFILES (Role & Status Mapping) ───
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles; CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- No insert/update policy because profiles are created/updated via Trigger/Admin.
-- Admins using SECURITY DEFINER functions bypass RLS.

-- ─── Profile Trigger ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, is_active)
  VALUES (new.id, new.email, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ADMIN FUNCTIONS ───

-- Helper to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'fabiank5@hotmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Get all users
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.is_active, p.created_at
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update user status
CREATE OR REPLACE FUNCTION admin_update_user_status(target_id UUID, new_status BOOLEAN)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles SET is_active = new_status WHERE profiles.id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Delete user
CREATE OR REPLACE FUNCTION admin_delete_user(target_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Delete associated records before deleting the user (components cascade via bike_id)
  DELETE FROM user_preferences WHERE user_id = target_id;
  DELETE FROM rides WHERE user_id = target_id;
  DELETE FROM suspension_setups WHERE user_id = target_id;
  DELETE FROM bikes WHERE user_id = target_id;

  DELETE FROM auth.users WHERE auth.users.id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update user password
-- Uses pgcrypto extension to hash the password
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_update_user_password(target_id UUID, new_password TEXT)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE auth.users.id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

