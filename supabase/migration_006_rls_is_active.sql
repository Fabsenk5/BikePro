-- ============================================
-- Migration 006: Enforce Beta Activation (is_active) server-side
-- + harden SECURITY DEFINER functions with fixed search_path
-- ============================================

-- ─── Active-user check (bypasses RLS to read profiles) ───
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_active FROM profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ─── RLS Policies: require ownership AND active account ───
-- NOTE: profiles is intentionally untouched — users must always be able
-- to read their own profile row so the client-side activation check works.

DROP POLICY IF EXISTS "Users can view own bikes" ON bikes; CREATE POLICY "Users can view own bikes" ON bikes
    FOR SELECT USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can insert own bikes" ON bikes; CREATE POLICY "Users can insert own bikes" ON bikes
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can update own bikes" ON bikes; CREATE POLICY "Users can update own bikes" ON bikes
    FOR UPDATE USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can delete own bikes" ON bikes; CREATE POLICY "Users can delete own bikes" ON bikes
    FOR DELETE USING (auth.uid() = user_id AND is_active_user());

DROP POLICY IF EXISTS "Users can view own components" ON components; CREATE POLICY "Users can view own components" ON components
    FOR SELECT USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can insert own components" ON components; CREATE POLICY "Users can insert own components" ON components
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can update own components" ON components; CREATE POLICY "Users can update own components" ON components
    FOR UPDATE USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can delete own components" ON components; CREATE POLICY "Users can delete own components" ON components
    FOR DELETE USING (auth.uid() = user_id AND is_active_user());

DROP POLICY IF EXISTS "Users can view own setups" ON suspension_setups; CREATE POLICY "Users can view own setups" ON suspension_setups
    FOR SELECT USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can insert own setups" ON suspension_setups; CREATE POLICY "Users can insert own setups" ON suspension_setups
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can update own setups" ON suspension_setups; CREATE POLICY "Users can update own setups" ON suspension_setups
    FOR UPDATE USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can delete own setups" ON suspension_setups; CREATE POLICY "Users can delete own setups" ON suspension_setups
    FOR DELETE USING (auth.uid() = user_id AND is_active_user());

DROP POLICY IF EXISTS "Users can view own rides" ON rides; CREATE POLICY "Users can view own rides" ON rides
    FOR SELECT USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can insert own rides" ON rides; CREATE POLICY "Users can insert own rides" ON rides
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can update own rides" ON rides; CREATE POLICY "Users can update own rides" ON rides
    FOR UPDATE USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can delete own rides" ON rides; CREATE POLICY "Users can delete own rides" ON rides
    FOR DELETE USING (auth.uid() = user_id AND is_active_user());

DROP POLICY IF EXISTS "Users can view own prefs" ON user_preferences; CREATE POLICY "Users can view own prefs" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can insert own prefs" ON user_preferences; CREATE POLICY "Users can insert own prefs" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can update own prefs" ON user_preferences; CREATE POLICY "Users can update own prefs" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id AND is_active_user());
DROP POLICY IF EXISTS "Users can delete own prefs" ON user_preferences; CREATE POLICY "Users can delete own prefs" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id AND is_active_user());

-- ─── Hardening: fixed search_path for all SECURITY DEFINER functions ───
-- (definitions copied from migration.sql, logic unchanged)

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, auth, pg_temp;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, is_active)
  VALUES (new.id, new.email, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'fabiank5@hotmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

CREATE OR REPLACE FUNCTION admin_update_user_status(target_id UUID, new_status BOOLEAN)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles SET is_active = new_status WHERE profiles.id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

CREATE OR REPLACE FUNCTION admin_update_user_password(target_id UUID, new_password TEXT)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password too short';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE auth.users.id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;
