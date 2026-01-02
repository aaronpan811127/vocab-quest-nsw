-- Create table for storing incorrect dictation answers (words only, no question_bank dependency)
CREATE TABLE public.attempt_incorrect_answers_dictation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.game_attempts(id) ON DELETE CASCADE,
  incorrect_word TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attempt_incorrect_answers_dictation ENABLE ROW LEVEL SECURITY;

-- Users can view their own incorrect answers
CREATE POLICY "Users can view own incorrect dictation answers"
ON public.attempt_incorrect_answers_dictation
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM game_attempts
  WHERE game_attempts.id = attempt_incorrect_answers_dictation.attempt_id
  AND game_attempts.user_id = auth.uid()
));

-- Users can insert their own incorrect answers
CREATE POLICY "Users can insert own incorrect dictation answers"
ON public.attempt_incorrect_answers_dictation
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM game_attempts
  WHERE game_attempts.id = attempt_incorrect_answers_dictation.attempt_id
  AND game_attempts.user_id = auth.uid()
));