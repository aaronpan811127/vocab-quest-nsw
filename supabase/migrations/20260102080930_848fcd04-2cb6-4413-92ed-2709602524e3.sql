-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a restrictive policy that only allows viewing own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

-- Create a secure function to get leaderboard data
-- This exposes only the necessary fields for leaderboard display
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  username text,
  level integer,
  total_xp integer,
  study_streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.level,
    p.total_xp,
    p.study_streak
  FROM public.profiles p
  ORDER BY p.total_xp DESC
  LIMIT GREATEST(1, LEAST(limit_count, 100)); -- Clamp between 1 and 100
$$;