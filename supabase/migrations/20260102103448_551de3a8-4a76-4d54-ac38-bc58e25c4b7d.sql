-- Drop and recreate view with explicit SECURITY INVOKER 
DROP VIEW IF EXISTS public.questions_for_play;

CREATE VIEW public.questions_for_play 
WITH (security_invoker = true) AS
SELECT 
  id, 
  unit_id, 
  passage_id, 
  game_type, 
  question_text, 
  options, 
  created_at
FROM public.question_bank;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.questions_for_play TO authenticated;