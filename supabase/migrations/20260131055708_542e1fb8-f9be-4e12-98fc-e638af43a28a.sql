-- Create table to store game configuration snapshots per user per unit
-- This locks in game config when a user first accesses a unit
CREATE TABLE public.user_unit_game_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    test_type_id UUID NOT NULL REFERENCES public.test_types(id) ON DELETE CASCADE,
    games_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure one snapshot per user per unit
    UNIQUE(user_id, unit_id)
);

-- Enable RLS
ALTER TABLE public.user_unit_game_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view their own snapshots
CREATE POLICY "Users can view own game snapshots"
ON public.user_unit_game_snapshots
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own snapshots
CREATE POLICY "Users can insert own game snapshots"
ON public.user_unit_game_snapshots
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Parents can view children's snapshots
CREATE POLICY "Parents can view children game snapshots"
ON public.user_unit_game_snapshots
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM parent_children pc
        JOIN parent_profiles pp ON pc.parent_id = pp.id
        WHERE pc.student_user_id = user_unit_game_snapshots.user_id
        AND pp.user_id = auth.uid()
        AND pc.relationship_status = 'active'
    )
);

-- Create index for faster lookups
CREATE INDEX idx_user_unit_game_snapshots_user_unit 
ON public.user_unit_game_snapshots(user_id, unit_id);

CREATE INDEX idx_user_unit_game_snapshots_test_type 
ON public.user_unit_game_snapshots(test_type_id);