-- Gate reading_passages by premium access (admin / trial / active sub / linked child)
DROP POLICY IF EXISTS "Authenticated users can view passages" ON public.reading_passages;

CREATE POLICY "Subscribers and trial users can view passages"
ON public.reading_passages
FOR SELECT
TO authenticated
USING (public.has_premium_access(auth.uid()));

-- Recreate the questions_for_play view as security_invoker so RLS on question_bank applies via caller
-- Add a premium-gated SELECT policy on question_bank for the play view
CREATE POLICY "Subscribers and trial users can view approved questions"
ON public.question_bank
FOR SELECT
TO authenticated
USING (
  public.has_premium_access(auth.uid())
  AND (review_status IS NULL OR review_status = 'approved' OR review_status = 'pending')
);

-- Make the play view honor caller's RLS instead of definer's
ALTER VIEW public.questions_for_play SET (security_invoker = true);