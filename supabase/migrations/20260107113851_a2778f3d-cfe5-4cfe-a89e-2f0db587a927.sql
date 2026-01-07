-- 1. Create the "Test" section
INSERT INTO game_sections (id, code, name, description, icon_name, display_order)
VALUES ('b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 'test', 'Test', 'Final assessment of vocabulary mastery', 'ClipboardCheck', 3);

-- 2. Create the two new games with rules for AI question generation
INSERT INTO games (id, game_type, name, description, icon_name, rules)
VALUES 
  ('c6d9e0f1-a2b3-4c5d-8e6f-7a8b9c0d1e2f', 'context_master', 'Context Master', 'Test your understanding of word meanings in different contexts', 'Target', '{"questions_per_word": 3, "questions_per_game": 15, "max_attempts": 1}'::jsonb),
  ('d7e0f1a2-b3c4-5d6e-8f7a-8b9c0d1e2f3a', 'cloze_challenge', 'Cloze Challenge', 'Fill in the blanks to demonstrate word mastery', 'FileQuestion', '{"questions_per_word": 3, "questions_per_game": 15, "max_attempts": 1}'::jsonb);

-- 3. Drop the view that depends on game_type column
DROP VIEW IF EXISTS questions_for_play;

-- 4. Add game_id and word columns to question_bank
ALTER TABLE question_bank ADD COLUMN game_id uuid REFERENCES games(id);
ALTER TABLE question_bank ADD COLUMN word text;

-- 5. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_question_bank_game_id ON question_bank(game_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_word ON question_bank(word);
CREATE INDEX IF NOT EXISTS idx_question_bank_unit_game_word ON question_bank(unit_id, game_id, word);

-- 6. Migrate existing question_bank data from game_type to game_id
UPDATE question_bank qb
SET game_id = g.id
FROM games g
WHERE qb.game_type = g.game_type;

-- 7. Make game_id NOT NULL after migration and drop game_type
ALTER TABLE question_bank ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE question_bank DROP COLUMN game_type;

-- 8. Recreate the view using game_id instead
CREATE VIEW questions_for_play AS
SELECT 
    qb.id,
    qb.unit_id,
    qb.passage_id,
    qb.game_id,
    qb.word,
    qb.question_text,
    qb.options,
    qb.created_at
FROM question_bank qb;

-- 9. Add test_type_games entries for all 4 test types for both new games
-- NAPLAN Year 3
INSERT INTO test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
VALUES 
  ('497b4056-f691-4800-aa50-4c151c9b25e5', 'c6d9e0f1-a2b3-4c5d-8e6f-7a8b9c0d1e2f', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 1, true, false, false),
  ('497b4056-f691-4800-aa50-4c151c9b25e5', 'd7e0f1a2-b3c4-5d6e-8f7a-8b9c0d1e2f3a', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 2, true, false, false);

-- NAPLAN Year 5
INSERT INTO test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
VALUES 
  ('9a18065d-d51c-466e-bafa-2728c0586ab0', 'c6d9e0f1-a2b3-4c5d-8e6f-7a8b9c0d1e2f', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 1, true, false, false),
  ('9a18065d-d51c-466e-bafa-2728c0586ab0', 'd7e0f1a2-b3c4-5d6e-8f7a-8b9c0d1e2f3a', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 2, true, false, false);

-- Opportunity Class
INSERT INTO test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
VALUES 
  ('9269e375-597f-41e6-b6f0-18a53c554fb8', 'c6d9e0f1-a2b3-4c5d-8e6f-7a8b9c0d1e2f', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 1, true, false, false),
  ('9269e375-597f-41e6-b6f0-18a53c554fb8', 'd7e0f1a2-b3c4-5d6e-8f7a-8b9c0d1e2f3a', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 2, true, false, false);

-- Selective School
INSERT INTO test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
VALUES 
  ('42779ffe-837a-4545-8d2d-1214b623a080', 'c6d9e0f1-a2b3-4c5d-8e6f-7a8b9c0d1e2f', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 1, true, false, false),
  ('42779ffe-837a-4545-8d2d-1214b623a080', 'd7e0f1a2-b3c4-5d6e-8f7a-8b9c0d1e2f3a', 'b5c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e', 2, true, false, false);

-- 10. Create a function to check if game allows more attempts
CREATE OR REPLACE FUNCTION public.check_game_attempt_allowed(
  p_user_id uuid,
  p_unit_id uuid,
  p_game_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_attempts integer;
  v_current_attempts integer;
BEGIN
  -- Get max_attempts from game rules
  SELECT (rules->>'max_attempts')::integer INTO v_max_attempts
  FROM games WHERE id = p_game_id;
  
  -- If no limit set, allow unlimited
  IF v_max_attempts IS NULL THEN
    RETURN true;
  END IF;
  
  -- Count current attempts
  SELECT COUNT(*) INTO v_current_attempts
  FROM game_attempts
  WHERE user_id = p_user_id AND unit_id = p_unit_id AND game_id = p_game_id;
  
  RETURN v_current_attempts < v_max_attempts;
END;
$$;

-- 11. Update RLS policies for question_bank
DROP POLICY IF EXISTS "Anyone can read questions" ON question_bank;
CREATE POLICY "Anyone can read questions" ON question_bank FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage questions" ON question_bank;
CREATE POLICY "Service role can manage questions" ON question_bank 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);