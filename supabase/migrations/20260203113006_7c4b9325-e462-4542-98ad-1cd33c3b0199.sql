-- Fix: Change view to use SECURITY INVOKER (default) instead of SECURITY DEFINER
-- The security_barrier is still needed to prevent information leakage through filter conditions

DROP VIEW IF EXISTS public.questions_for_play;

-- Recreate view with security_barrier but without SECURITY DEFINER
-- The view will use the invoker's permissions
CREATE VIEW public.questions_for_play 
WITH (security_barrier = true, security_invoker = true)
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

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.questions_for_play TO authenticated;