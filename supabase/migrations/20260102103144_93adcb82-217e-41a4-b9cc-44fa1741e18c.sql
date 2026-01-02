-- Create a secure view for client-side question access (excludes correct_answer)
CREATE VIEW public.questions_for_play AS
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

-- Revoke direct access to question_bank for regular users
-- (SECURITY DEFINER functions can still access it)
DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.question_bank;