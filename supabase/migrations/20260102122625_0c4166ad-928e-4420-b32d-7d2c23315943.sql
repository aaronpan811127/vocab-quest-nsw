-- Create test_type table
CREATE TABLE public.test_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_types ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view test types
CREATE POLICY "Anyone can view test types"
ON public.test_types
FOR SELECT
USING (true);

-- Insert initial test types
INSERT INTO public.test_types (code, name, description) VALUES
  ('NAPLAN_Y3', 'NAPLAN Year 3', 'National Assessment Program for Year 3 students'),
  ('NAPLAN_Y5', 'NAPLAN Year 5', 'National Assessment Program for Year 5 students'),
  ('OC', 'Opportunity Class', 'Opportunity Class placement test preparation'),
  ('SELECTIVE', 'Selective School', 'Selective high school entrance test preparation');

-- Add test_type_id to units table
ALTER TABLE public.units 
ADD COLUMN test_type_id uuid REFERENCES public.test_types(id);

-- Create leaderboard table with composite primary key
CREATE TABLE public.leaderboard (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_type_id uuid NOT NULL REFERENCES public.test_types(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  total_xp integer NOT NULL DEFAULT 0,
  study_streak integer NOT NULL DEFAULT 0,
  last_study_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, test_type_id)
);

-- Enable RLS on leaderboard
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Users can view all leaderboard entries (for leaderboard display)
CREATE POLICY "Anyone can view leaderboard"
ON public.leaderboard
FOR SELECT
USING (true);

-- Users can insert their own leaderboard entries
CREATE POLICY "Users can insert own leaderboard entries"
ON public.leaderboard
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own leaderboard entries
CREATE POLICY "Users can update own leaderboard entries"
ON public.leaderboard
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at on leaderboard
CREATE TRIGGER update_leaderboard_updated_at
BEFORE UPDATE ON public.leaderboard
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update get_leaderboard function to include test_type_id filter
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 10, p_test_type_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, username text, level integer, total_xp integer, study_streak integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.username,
    COALESCE(l.level, 1) as level,
    COALESCE(l.total_xp, 0) as total_xp,
    COALESCE(l.study_streak, 0) as study_streak
  FROM public.profiles p
  LEFT JOIN public.leaderboard l ON p.user_id = l.user_id 
    AND (p_test_type_id IS NULL OR l.test_type_id = p_test_type_id)
  ORDER BY COALESCE(l.total_xp, 0) DESC
  LIMIT GREATEST(1, LEAST(limit_count, 100));
$$;