-- Add columns to track game session timing for timed tests
ALTER TABLE public.game_attempts 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER;

-- Create index for efficient expired game lookup
CREATE INDEX IF NOT EXISTS idx_game_attempts_incomplete_sessions 
ON public.game_attempts (user_id, completed, started_at) 
WHERE completed = false AND started_at IS NOT NULL;