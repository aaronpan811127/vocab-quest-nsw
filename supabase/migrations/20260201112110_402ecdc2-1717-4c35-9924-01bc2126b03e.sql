-- Add unit_config column to store complete unit configuration snapshot
ALTER TABLE public.user_unit_game_snapshots 
ADD COLUMN unit_config jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_unit_game_snapshots.unit_config IS 'Snapshot of unit configuration (words, title, description, etc.) at the time the user first accessed this unit.';