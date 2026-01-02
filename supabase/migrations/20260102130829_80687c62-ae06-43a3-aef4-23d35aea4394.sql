-- Drop the old get_leaderboard functions
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);
DROP FUNCTION IF EXISTS public.get_leaderboard(integer, uuid);

-- Create new get_leaderboard function that properly filters by test type
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 10, p_test_type_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, username text, level integer, total_xp integer, study_streak integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.username,
    l.level,
    l.total_xp,
    l.study_streak
  FROM public.leaderboard l
  INNER JOIN public.profiles p ON p.user_id = l.user_id
  WHERE l.test_type_id = p_test_type_id
  ORDER BY l.total_xp DESC
  LIMIT GREATEST(1, LEAST(limit_count, 100));
$$;

-- Remove XP, level, streak columns from profiles table (data now lives in leaderboard table per test type)
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS total_xp,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS study_streak,
  DROP COLUMN IF EXISTS last_study_date;