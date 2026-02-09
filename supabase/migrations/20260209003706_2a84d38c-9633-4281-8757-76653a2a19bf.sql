CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 10, p_test_type_id uuid DEFAULT NULL)
RETURNS TABLE(username text, level integer, total_xp integer, study_streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.username,
    l.level,
    l.total_xp,
    l.study_streak
  FROM public.leaderboard l
  INNER JOIN public.profiles p ON p.user_id = l.user_id
  WHERE p.username IS NOT NULL
    AND l.total_xp > 0
    AND (p_test_type_id IS NULL OR l.test_type_id = p_test_type_id)
  ORDER BY l.total_xp DESC, l.level DESC
  LIMIT limit_count;
$$;