-- Fix 1: Gate vocabulary behind active subscription / trial
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view vocabulary" ON public.vocabulary;

-- Helper: check if a user has access to premium content
CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admins always
    public.is_admin(_user_id)
    -- User is within 7-day trial on their own profile
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id
        AND p.trial_started_at IS NOT NULL
        AND p.trial_started_at > (now() - interval '7 days')
    )
    -- User is a parent with an active subscription
    OR EXISTS (
      SELECT 1 FROM public.parent_profiles pp
      WHERE pp.user_id = _user_id
        AND pp.subscription_status = 'active'
    )
    -- User is a student linked to a parent with an active subscription
    OR EXISTS (
      SELECT 1
      FROM public.parent_children pc
      JOIN public.parent_profiles pp ON pp.id = pc.parent_id
      WHERE pc.student_user_id = _user_id
        AND pc.relationship_status = 'active'
        AND pp.subscription_status = 'active'
    );
$$;

CREATE POLICY "Subscribers and trial users can view vocabulary"
ON public.vocabulary
FOR SELECT
TO authenticated
USING (public.has_premium_access(auth.uid()));
