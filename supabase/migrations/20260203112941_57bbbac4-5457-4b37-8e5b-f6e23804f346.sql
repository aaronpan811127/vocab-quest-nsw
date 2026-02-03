-- Fix: Restrict question_bank access to prevent answer leakage
-- Students should only access questions via the questions_for_play view

-- Step 1: Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read questions" ON public.question_bank;

-- Step 2: Add restrictive policy - only admins can read question_bank directly
CREATE POLICY "Only admins can read question_bank"
ON public.question_bank
FOR SELECT
USING (is_admin(auth.uid()));

-- Step 3: Recreate the questions_for_play view with security_barrier
-- This view excludes correct_answer and is safe for student access
DROP VIEW IF EXISTS public.questions_for_play;

CREATE VIEW public.questions_for_play 
WITH (security_barrier = true)
AS
SELECT 
  id,
  unit_id,
  passage_id,
  game_id,
  question_text,
  options,
  word,
  created_at
FROM public.question_bank
WHERE review_status = 'approved' OR review_status IS NULL;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.questions_for_play TO authenticated;

-- Step 4: Create a SECURITY DEFINER function for getting questions for games
-- This allows the view to bypass RLS while keeping the table secure
CREATE OR REPLACE FUNCTION public.get_questions_for_game(
  p_game_id uuid,
  p_unit_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  unit_id uuid,
  passage_id uuid,
  game_id uuid,
  question_text text,
  options jsonb,
  word text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    qb.id,
    qb.unit_id,
    qb.passage_id,
    qb.game_id,
    qb.question_text,
    qb.options,
    qb.word
  FROM public.question_bank qb
  WHERE qb.game_id = p_game_id
    AND qb.unit_id = p_unit_id
    AND (qb.review_status = 'approved' OR qb.review_status IS NULL)
  ORDER BY random()
  LIMIT p_limit;
$$;