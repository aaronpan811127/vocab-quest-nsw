-- Function: Auto-create parent profile when auth user is created with parent metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Check if this is a parent signup (from metadata)
  IF NEW.raw_user_meta_data->>'signup_type' = 'parent' THEN
    -- Create parent profile
    INSERT INTO public.parent_profiles (user_id, parent_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'parent_name', split_part(NEW.email, '@', 1))
    );
  ELSE
    -- Create student profile (default behavior)
    INSERT INTO public.profiles (user_id, username)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- 2. CREATE TRIGGER ON AUTH.USERS
-- =============================================

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run after user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. GRANT PERMISSIONS TO SERVICE ROLE
-- =============================================

-- Allow service role to insert profiles during trigger execution
GRANT INSERT ON public.parent_profiles TO service_role;
GRANT INSERT ON public.profiles TO service_role;