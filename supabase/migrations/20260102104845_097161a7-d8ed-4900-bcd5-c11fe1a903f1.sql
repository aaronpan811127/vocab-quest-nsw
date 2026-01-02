-- Remove the policy we just added (it exposes correct_answer)
DROP POLICY IF EXISTS "Authenticated users can select questions" ON public.question_bank;

-- Drop the SECURITY INVOKER view
DROP VIEW IF EXISTS public.questions_for_play;

-- Create view with SECURITY DEFINER so it runs with owner permissions
-- This way users don't need direct table access
CREATE VIEW public.questions_for_play 
WITH (security_barrier = true) AS
SELECT 
  id, 
  unit_id, 
  passage_id, 
  game_type, 
  question_text, 
  options, 
  created_at
FROM public.question_bank;

-- Set the view to be owned by postgres (has access to all tables)
ALTER VIEW public.questions_for_play OWNER TO postgres;

-- Grant access to authenticated users on the view only
GRANT SELECT ON public.questions_for_play TO authenticated;