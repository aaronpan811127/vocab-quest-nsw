-- Fix the overly permissive profiles SELECT policy
-- The current policy has "true OR ..." which makes all profiles publicly readable

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- The "Users can view own profile" policy already exists and handles owner access
-- We just need to ensure parents can view their children's profiles

-- Create a policy for parents to view their children's profiles
CREATE POLICY "Parents can view children profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    INNER JOIN public.parent_profiles pp ON pc.parent_id = pp.id
    WHERE pc.student_user_id = profiles.user_id
    AND pp.user_id = auth.uid()
    AND pc.relationship_status = 'active'
  )
);