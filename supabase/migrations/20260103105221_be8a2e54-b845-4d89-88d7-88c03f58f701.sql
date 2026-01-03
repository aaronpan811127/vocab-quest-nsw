-- Migration: Add Parent Features
-- Description: Add parent_profiles, parent_children, and user_roles tables with RLS policies

-- =============================================
-- 1. CREATE TABLES
-- =============================================

-- Table: parent_profiles
CREATE TABLE public.parent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL,
  phone_number TEXT,
  billing_email TEXT,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'cancelled', 'expired')),
  subscription_tier TEXT,
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: parent_children
CREATE TABLE public.parent_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  relationship_status TEXT DEFAULT 'active' CHECK (relationship_status IN ('active', 'pending', 'removed')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  notes TEXT
);

-- Table: user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'parent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- =============================================
-- 2. CREATE INDEXES
-- =============================================

CREATE INDEX idx_parent_children_parent_id ON public.parent_children(parent_id);
CREATE INDEX idx_parent_children_student_user_id ON public.parent_children(student_user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS POLICIES FOR parent_profiles
-- =============================================

CREATE POLICY "Parents can view own profile"
ON public.parent_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Parents can update own profile"
ON public.parent_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Parents can insert own profile"
ON public.parent_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 5. RLS POLICIES FOR parent_children
-- =============================================

CREATE POLICY "Parents can view own children"
ON public.parent_children FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parent_profiles
    WHERE id = parent_children.parent_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Parents can add children"
ON public.parent_children FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parent_profiles
    WHERE id = parent_children.parent_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Parents can update own children"
ON public.parent_children FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.parent_profiles
    WHERE id = parent_children.parent_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Students can view own parent link"
ON public.parent_children FOR SELECT
USING (student_user_id = auth.uid());

-- =============================================
-- 6. RLS POLICIES FOR user_roles
-- =============================================

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- =============================================
-- 7. ENHANCED RLS POLICIES FOR EXISTING TABLES
-- =============================================

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles FOR SELECT
USING (
  true
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.parent_children pc
    INNER JOIN public.parent_profiles pp ON pc.parent_id = pp.id
    WHERE pc.student_user_id = profiles.user_id
    AND pp.user_id = auth.uid()
    AND pc.relationship_status = 'active'
  )
);

CREATE POLICY "Parents can update children profiles"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.parent_children pc
    INNER JOIN public.parent_profiles pp ON pc.parent_id = pp.id
    WHERE pc.student_user_id = profiles.user_id
    AND pp.user_id = auth.uid()
    AND pc.relationship_status = 'active'
  )
);

-- =============================================
-- 8. PARENT ACCESS TO CHILD DATA
-- =============================================

CREATE POLICY "Parents can view children progress"
ON public.user_progress FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.parent_children pc
    INNER JOIN public.parent_profiles pp ON pc.parent_id = pp.id
    WHERE pc.student_user_id = user_progress.user_id
    AND pp.user_id = auth.uid()
    AND pc.relationship_status = 'active'
  )
);

CREATE POLICY "Parents can view children attempts"
ON public.game_attempts FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.parent_children pc
    INNER JOIN public.parent_profiles pp ON pc.parent_id = pp.id
    WHERE pc.student_user_id = game_attempts.user_id
    AND pp.user_id = auth.uid()
    AND pc.relationship_status = 'active'
  )
);

CREATE POLICY "Parents can view children leaderboard"
ON public.leaderboard FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.parent_children pc
    INNER JOIN public.parent_profiles pp ON pc.parent_id = pp.id
    WHERE pc.student_user_id = leaderboard.user_id
    AND pp.user_id = auth.uid()
    AND pc.relationship_status = 'active'
  )
);

-- =============================================
-- 9. DATABASE FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id UUID)
RETURNS TABLE(role TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.check_child_availability(p_student_email TEXT)
RETURNS TABLE(
  available BOOLEAN,
  existing_user_id UUID,
  has_parent BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_has_parent BOOLEAN;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_student_email;

  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.parent_children
      WHERE student_user_id = v_user_id
      AND relationship_status = 'active'
    ) INTO v_has_parent;
  ELSE
    v_has_parent := FALSE;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT TRUE, NULL::UUID, FALSE, 'New student - can create account';
  ELSIF v_has_parent THEN
    RETURN QUERY SELECT FALSE, v_user_id, TRUE, 'Student already linked to another parent';
  ELSE
    RETURN QUERY SELECT TRUE, v_user_id, FALSE, 'Existing student - can link';
  END IF;
END;
$$;

-- =============================================
-- 10. TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_profile_role_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_profile_role_creation();

CREATE OR REPLACE FUNCTION public.handle_parent_role_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'parent')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_parent_profile_created
AFTER INSERT ON public.parent_profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_parent_role_creation();

CREATE TRIGGER update_parent_profiles_updated_at
BEFORE UPDATE ON public.parent_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 11. GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE ON public.parent_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.parent_children TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;