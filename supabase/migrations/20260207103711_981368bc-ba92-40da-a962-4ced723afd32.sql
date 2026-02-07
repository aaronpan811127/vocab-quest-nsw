
-- Recreate the questions_for_play view WITHOUT security_invoker
-- so students can read questions through the view (which hides correct_answer)
-- while the base question_bank table remains admin-only for direct access
DROP VIEW IF EXISTS public.questions_for_play;

CREATE VIEW public.questions_for_play
WITH (security_barrier=true) AS
  SELECT id,
    unit_id,
    passage_id,
    game_id,
    question_text,
    options,
    word,
    created_at
  FROM question_bank qb
  WHERE ((review_status IS NULL) OR (review_status = 'approved'::text) OR (review_status = 'pending'::text));

-- Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.questions_for_play TO authenticated;
GRANT SELECT ON public.questions_for_play TO anon;
