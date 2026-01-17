-- Add session_data column to game_attempts for storing in-progress test answers
ALTER TABLE public.game_attempts 
ADD COLUMN IF NOT EXISTS session_data jsonb DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.game_attempts.session_data IS 'Stores in-progress test data including current_question index, selected_answers array, and question_ids for resuming sessions';