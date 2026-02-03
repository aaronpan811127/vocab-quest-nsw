-- Fix 1: Remove profile.id from get_leaderboard function return type
-- This prevents unnecessary exposure of internal UUIDs
DROP FUNCTION IF EXISTS public.get_leaderboard(integer, uuid);

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  limit_count integer DEFAULT 10,
  p_test_type_id uuid DEFAULT NULL
)
RETURNS TABLE(
  username text,
  level integer,
  total_xp integer,
  study_streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.username,
    COALESCE(l.level, 1) as level,
    COALESCE(l.total_xp, 0) as total_xp,
    COALESCE(l.study_streak, 0) as study_streak
  FROM public.profiles p
  LEFT JOIN public.leaderboard l ON p.user_id = l.user_id
    AND (p_test_type_id IS NULL OR l.test_type_id = p_test_type_id)
  WHERE p.username IS NOT NULL
  ORDER BY COALESCE(l.total_xp, 0) DESC, COALESCE(l.level, 1) DESC
  LIMIT limit_count;
$$;

-- Fix 2: Update check_child_availability to only allow parents
DROP FUNCTION IF EXISTS public.check_child_availability(text);

CREATE OR REPLACE FUNCTION public.check_child_availability(p_student_email TEXT)
RETURNS TABLE(
  available BOOLEAN,
  existing_user_id UUID,
  has_parent BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_has_parent BOOLEAN;
BEGIN
  -- Authorization check: Only parents can use this function
  IF NOT EXISTS (
    SELECT 1 FROM public.parent_profiles 
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only parents can check child availability';
  END IF;

  -- Check if email exists in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_student_email;
  
  IF v_user_id IS NULL THEN
    -- Email not registered
    RETURN QUERY SELECT true, NULL::UUID, false, 'Email is available for new account'::TEXT;
    RETURN;
  END IF;
  
  -- Check if this user already has a parent
  SELECT EXISTS(
    SELECT 1 FROM public.parent_children
    WHERE student_user_id = v_user_id
    AND relationship_status = 'active'
  ) INTO v_has_parent;
  
  -- Check if user is a student (has profile but not a parent)
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.parent_profiles WHERE user_id = v_user_id
  ) THEN
    IF v_has_parent THEN
      RETURN QUERY SELECT false, v_user_id, true, 'This student is already linked to another parent'::TEXT;
    ELSE
      RETURN QUERY SELECT true, v_user_id, false, 'Student found and available to link'::TEXT;
    END IF;
  ELSE
    -- User exists but is not a student (might be a parent account)
    RETURN QUERY SELECT false, NULL::UUID, false, 'This email belongs to a parent account, not a student'::TEXT;
  END IF;
  
  RETURN;
END;
$$;

-- Fix 3: Remove the self-grant parent role policy
-- Role assignment should be handled only by triggers
DROP POLICY IF EXISTS "Users can insert own parent role" ON public.user_roles;