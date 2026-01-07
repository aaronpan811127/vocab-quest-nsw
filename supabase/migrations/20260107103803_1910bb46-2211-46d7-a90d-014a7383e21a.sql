-- Phase 1: Create new tables

-- 1.1 Create game_sections table
CREATE TABLE public.game_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view game_sections" ON public.game_sections FOR SELECT USING (true);

-- Seed game_sections
INSERT INTO public.game_sections (code, name, description, display_order, icon_name) VALUES
  ('learn', 'Learn', 'Practice and master vocabulary', 1, 'BookOpen'),
  ('challenge', 'Challenge', 'Earn XP and level up', 2, 'Trophy');

-- 1.2 Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);

-- Seed games
INSERT INTO public.games (game_type, name, description, icon_name) VALUES
  ('flashcards', 'Flashcards', 'Review words with interactive flashcards', 'Layers'),
  ('matching', 'Matching', 'Match words with their definitions', 'Link2'),
  ('oddoneout', 'Odd One Out', 'Find the word that doesn''t belong', 'CircleOff'),
  ('intuition', 'Word Intuition', 'Test your word sense with context clues', 'Lightbulb'),
  ('reading', 'Reading Quest', 'Embark on reading adventures with comprehension challenges', 'BookOpen'),
  ('listening', 'Audio Challenge', 'Listen and spell words perfectly to advance', 'Headphones'),
  ('speaking', 'Voice Master', 'Speak clearly and accurately to unlock achievements', 'Mic'),
  ('writing', 'Story Creator', 'Craft creative sentences using your new vocabulary', 'PenTool');

-- 1.3 Create test_type_games table
CREATE TABLE public.test_type_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type_id UUID NOT NULL REFERENCES public.test_types(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.game_sections(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  contributes_to_xp BOOLEAN NOT NULL DEFAULT true,
  required_for_unlock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_type_id, game_id)
);

-- Enable RLS
ALTER TABLE public.test_type_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view test_type_games" ON public.test_type_games FOR SELECT USING (true);

-- 1.4 Seed test_type_games for all test types
-- Get section IDs
DO $$
DECLARE
  v_learn_section_id UUID;
  v_challenge_section_id UUID;
  v_test_type RECORD;
  v_game RECORD;
  v_order INTEGER;
BEGIN
  SELECT id INTO v_learn_section_id FROM public.game_sections WHERE code = 'learn';
  SELECT id INTO v_challenge_section_id FROM public.game_sections WHERE code = 'challenge';
  
  -- For each test type
  FOR v_test_type IN SELECT id FROM public.test_types LOOP
    v_order := 1;
    
    -- Learn games (contributes_to_xp = false)
    FOR v_game IN SELECT id, game_type FROM public.games WHERE game_type IN ('flashcards', 'matching', 'oddoneout', 'intuition') ORDER BY 
      CASE game_type 
        WHEN 'flashcards' THEN 1 
        WHEN 'matching' THEN 2 
        WHEN 'oddoneout' THEN 3 
        WHEN 'intuition' THEN 4 
      END
    LOOP
      INSERT INTO public.test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
      VALUES (v_test_type.id, v_game.id, v_learn_section_id, v_order, true, false, true);
      v_order := v_order + 1;
    END LOOP;
    
    v_order := 1;
    
    -- Challenge games (contributes_to_xp = true)
    FOR v_game IN SELECT id, game_type FROM public.games WHERE game_type IN ('reading', 'listening', 'speaking', 'writing') ORDER BY 
      CASE game_type 
        WHEN 'reading' THEN 1 
        WHEN 'listening' THEN 2 
        WHEN 'speaking' THEN 3 
        WHEN 'writing' THEN 4 
      END
    LOOP
      INSERT INTO public.test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
      VALUES (v_test_type.id, v_game.id, v_challenge_section_id, v_order, true, true, true);
      v_order := v_order + 1;
    END LOOP;
  END LOOP;
END $$;

-- 1.5 Migrate game_attempts table
-- Add game_id column
ALTER TABLE public.game_attempts ADD COLUMN game_id UUID REFERENCES public.games(id);

-- Migrate existing data
UPDATE public.game_attempts ga
SET game_id = g.id
FROM public.games g
WHERE ga.game_type = g.game_type;

-- Make game_id NOT NULL
ALTER TABLE public.game_attempts ALTER COLUMN game_id SET NOT NULL;

-- Create index
CREATE INDEX idx_game_attempts_game_id ON public.game_attempts(game_id);

-- Drop game_type column
ALTER TABLE public.game_attempts DROP COLUMN game_type;

-- 1.6 Migrate user_progress table
-- Add game_id column
ALTER TABLE public.user_progress ADD COLUMN game_id UUID REFERENCES public.games(id);

-- Migrate existing data
UPDATE public.user_progress up
SET game_id = g.id
FROM public.games g
WHERE up.game_type = g.game_type;

-- Make game_id NOT NULL
ALTER TABLE public.user_progress ALTER COLUMN game_id SET NOT NULL;

-- Create new unique constraint
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_user_id_unit_id_game_id_key 
  UNIQUE (user_id, unit_id, game_id);

-- Create index
CREATE INDEX idx_user_progress_game_id ON public.user_progress(game_id);

-- Drop game_type column
ALTER TABLE public.user_progress DROP COLUMN game_type;

-- Phase 2: Create helper function
CREATE OR REPLACE FUNCTION public.get_test_type_games(p_test_type_id UUID)
RETURNS TABLE (
  game_id UUID,
  game_type TEXT,
  game_name TEXT,
  description TEXT,
  icon_name TEXT,
  rules JSONB,
  section_id UUID,
  section_code TEXT,
  section_name TEXT,
  section_display_order INTEGER,
  display_order INTEGER,
  contributes_to_xp BOOLEAN,
  required_for_unlock BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    g.id,
    g.game_type,
    g.name,
    g.description,
    g.icon_name,
    g.rules,
    gs.id,
    gs.code,
    gs.name,
    gs.display_order,
    ttg.display_order,
    ttg.contributes_to_xp,
    ttg.required_for_unlock
  FROM public.test_type_games ttg
  JOIN public.games g ON g.id = ttg.game_id
  JOIN public.game_sections gs ON gs.id = ttg.section_id
  WHERE ttg.test_type_id = p_test_type_id
    AND ttg.is_enabled = true
  ORDER BY gs.display_order, ttg.display_order;
$$;

-- Phase 3: Update validate_game_submission function
CREATE OR REPLACE FUNCTION public.validate_game_submission(
  p_user_id uuid, 
  p_unit_id uuid, 
  p_passage_id uuid, 
  p_game_id uuid,
  p_answers jsonb, 
  p_time_spent_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_count integer := 0;
  v_total_questions integer := 0;
  v_score integer;
  v_game_xp integer := 0;
  v_total_xp integer := 0;
  v_is_perfect boolean;
  v_attempt_id uuid;
  v_answer record;
  v_question record;
  v_user_answer text;
  v_new_level integer;
  v_new_streak integer;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
  v_existing_progress record;
  v_incorrect_answers jsonb := '[]'::jsonb;
  v_avg_score numeric;
  v_avg_time_per_question numeric;
  v_current_streak integer;
  v_last_study date;
  v_game_type text;
  v_game_record record;
  v_test_type_id uuid;
  v_contributes_to_xp boolean;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid user');
  END IF;

  -- Validate game exists and get game_type
  SELECT game_type INTO v_game_type FROM games WHERE id = p_game_id;
  IF v_game_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid game');
  END IF;

  -- Get user's default test type
  SELECT default_test_type_id INTO v_test_type_id
  FROM profiles WHERE user_id = p_user_id;
  
  -- If no default test type, get the first one
  IF v_test_type_id IS NULL THEN
    SELECT id INTO v_test_type_id FROM test_types LIMIT 1;
  END IF;

  -- Check if this game contributes to XP for this test type
  SELECT ttg.contributes_to_xp INTO v_contributes_to_xp
  FROM test_type_games ttg
  WHERE ttg.test_type_id = v_test_type_id AND ttg.game_id = p_game_id;
  
  v_contributes_to_xp := COALESCE(v_contributes_to_xp, true);

  -- Process each answer
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_id uuid, answer_index integer)
  LOOP
    SELECT * INTO v_question 
    FROM question_bank 
    WHERE id = v_answer.question_id 
      AND passage_id = p_passage_id
      AND game_type = v_game_type;
    
    IF v_question IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid question');
    END IF;
    
    v_total_questions := v_total_questions + 1;
    v_user_answer := v_question.options->>v_answer.answer_index;
    
    IF v_user_answer = v_question.correct_answer THEN
      v_correct_count := v_correct_count + 1;
    ELSE
      v_incorrect_answers := v_incorrect_answers || jsonb_build_object(
        'question_id', v_answer.question_id,
        'user_answer', v_user_answer
      );
    END IF;
  END LOOP;

  IF v_total_questions = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid answers provided');
  END IF;

  v_score := round((v_correct_count::numeric / v_total_questions::numeric) * 100);
  v_is_perfect := v_correct_count = v_total_questions;

  -- Insert game attempt
  INSERT INTO game_attempts (user_id, unit_id, passage_id, game_id, score, correct_answers, total_questions, time_spent_seconds, completed)
  VALUES (p_user_id, p_unit_id, p_passage_id, p_game_id, v_score, v_correct_count, v_total_questions, p_time_spent_seconds, true)
  RETURNING id INTO v_attempt_id;

  -- Insert incorrect answers
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(v_incorrect_answers) AS x(question_id uuid, user_answer text)
  LOOP
    INSERT INTO attempt_incorrect_answers (attempt_id, question_id, user_answer)
    VALUES (v_attempt_id, v_answer.question_id, v_answer.user_answer);
  END LOOP;

  -- Calculate average score and time for THIS specific game (unit + game_id)
  SELECT 
    AVG(score),
    AVG(time_spent_seconds::numeric / NULLIF(total_questions, 0))
  INTO v_avg_score, v_avg_time_per_question
  FROM game_attempts
  WHERE user_id = p_user_id 
    AND unit_id = p_unit_id 
    AND game_id = p_game_id;

  -- Calculate XP for THIS game based on averages (only if contributes_to_xp)
  IF v_contributes_to_xp THEN
    v_game_xp := GREATEST(0, round(COALESCE(v_avg_score, 0) * 0.5));
    
    IF v_avg_time_per_question IS NOT NULL THEN
      IF v_avg_time_per_question <= 5 THEN
        v_game_xp := v_game_xp + 25;
      ELSIF v_avg_time_per_question < 30 THEN
        v_game_xp := v_game_xp + GREATEST(0, round(25 - (v_avg_time_per_question - 5)));
      END IF;
    END IF;
  ELSE
    v_game_xp := 0;
  END IF;

  -- Update user_progress for this specific game
  SELECT * INTO v_existing_progress 
  FROM user_progress 
  WHERE user_id = p_user_id AND unit_id = p_unit_id AND game_id = p_game_id;
  
  IF v_existing_progress IS NOT NULL THEN
    UPDATE user_progress SET
      attempts = COALESCE(attempts, 0) + 1,
      total_time_seconds = COALESCE(total_time_seconds, 0) + p_time_spent_seconds,
      total_xp = v_game_xp,
      best_score = GREATEST(COALESCE(best_score, 0), v_score),
      completed = completed OR v_is_perfect,
      updated_at = now()
    WHERE id = v_existing_progress.id;
  ELSE
    INSERT INTO user_progress (user_id, unit_id, game_id, best_score, total_xp, total_time_seconds, attempts, completed)
    VALUES (p_user_id, p_unit_id, p_game_id, v_score, v_game_xp, p_time_spent_seconds, 1, v_is_perfect);
  END IF;

  -- Calculate TOTAL XP by summing XP across ALL games (only games that contribute to XP)
  SELECT COALESCE(SUM(up.total_xp), 0) INTO v_total_xp
  FROM user_progress up
  JOIN test_type_games ttg ON ttg.game_id = up.game_id AND ttg.test_type_id = v_test_type_id
  WHERE up.user_id = p_user_id AND ttg.contributes_to_xp = true;

  v_new_level := (v_total_xp / 100) + 1;

  -- Get current streak info from leaderboard table
  SELECT study_streak, last_study_date INTO v_current_streak, v_last_study
  FROM leaderboard WHERE user_id = p_user_id AND test_type_id = v_test_type_id;

  -- Calculate new streak
  v_new_streak := COALESCE(v_current_streak, 0);
  IF v_last_study IS DISTINCT FROM v_today THEN
    IF v_last_study = v_yesterday THEN
      v_new_streak := v_new_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
  END IF;

  -- Update or insert leaderboard entry
  INSERT INTO leaderboard (user_id, test_type_id, total_xp, level, study_streak, last_study_date, updated_at)
  VALUES (p_user_id, v_test_type_id, v_total_xp, v_new_level, v_new_streak, v_today, now())
  ON CONFLICT (user_id, test_type_id) 
  DO UPDATE SET
    total_xp = v_total_xp,
    level = v_new_level,
    study_streak = v_new_streak,
    last_study_date = v_today,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'correct_count', v_correct_count,
    'total_questions', v_total_questions,
    'game_xp', v_game_xp,
    'total_xp', v_total_xp,
    'avg_score', round(COALESCE(v_avg_score, 0)),
    'avg_time_per_question', round(COALESCE(v_avg_time_per_question, 0)),
    'is_perfect', v_is_perfect,
    'attempt_id', v_attempt_id
  );
END;
$$;

-- Phase 4: Update validate_dictation_game_submission function
CREATE OR REPLACE FUNCTION public.validate_dictation_game_submission(
  p_user_id uuid, 
  p_unit_id uuid, 
  p_game_id uuid,
  p_answers jsonb, 
  p_time_spent_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_count integer := 0;
  v_total_questions integer := 0;
  v_score integer;
  v_game_xp integer := 0;
  v_total_xp integer := 0;
  v_is_perfect boolean;
  v_attempt_id uuid;
  v_answer record;
  v_unit_words jsonb;
  v_word_list text[];
  v_new_level integer;
  v_new_streak integer;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
  v_existing_progress record;
  v_avg_score numeric;
  v_avg_time_per_question numeric;
  v_current_streak integer;
  v_last_study date;
  v_incorrect_answers jsonb := '[]'::jsonb;
  v_test_type_id uuid;
  v_game_type text;
  v_contributes_to_xp boolean;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid user');
  END IF;

  -- Validate game exists and get game_type
  SELECT game_type INTO v_game_type FROM games WHERE id = p_game_id;
  IF v_game_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid game');
  END IF;

  -- Validate game type is a dictation game
  IF v_game_type NOT IN ('listening', 'writing', 'speaking') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid game type for dictation');
  END IF;

  -- Validate time is reasonable (1 second to 30 minutes)
  IF p_time_spent_seconds < 1 OR p_time_spent_seconds > 1800 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid time spent');
  END IF;

  -- Get unit words for validation
  SELECT words INTO v_unit_words FROM units WHERE id = p_unit_id;
  IF v_unit_words IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid unit');
  END IF;

  -- Get user's default test type
  SELECT default_test_type_id INTO v_test_type_id
  FROM profiles WHERE user_id = p_user_id;
  
  -- If no default test type, get the first one
  IF v_test_type_id IS NULL THEN
    SELECT id INTO v_test_type_id FROM test_types LIMIT 1;
  END IF;

  -- Check if this game contributes to XP for this test type
  SELECT ttg.contributes_to_xp INTO v_contributes_to_xp
  FROM test_type_games ttg
  WHERE ttg.test_type_id = v_test_type_id AND ttg.game_id = p_game_id;
  
  v_contributes_to_xp := COALESCE(v_contributes_to_xp, true);

  -- Convert jsonb array to text array for comparison
  SELECT array_agg(lower(word::text)) INTO v_word_list
  FROM jsonb_array_elements_text(v_unit_words) AS word;

  -- Process each answer
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(word text, user_answer text)
  LOOP
    -- Validate the word belongs to this unit
    IF NOT (lower(v_answer.word) = ANY(v_word_list)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid word in answers');
    END IF;
    
    v_total_questions := v_total_questions + 1;
    
    -- Server-side answer validation (case-insensitive comparison)
    IF lower(trim(v_answer.user_answer)) = lower(trim(v_answer.word)) THEN
      v_correct_count := v_correct_count + 1;
    ELSE
      v_incorrect_answers := v_incorrect_answers || jsonb_build_object(
        'word', v_answer.word,
        'user_answer', v_answer.user_answer
      );
    END IF;
  END LOOP;

  IF v_total_questions = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid answers provided');
  END IF;

  v_score := round((v_correct_count::numeric / v_total_questions::numeric) * 100);
  v_is_perfect := v_correct_count = v_total_questions;

  -- Insert game attempt
  INSERT INTO game_attempts (user_id, unit_id, game_id, score, correct_answers, total_questions, time_spent_seconds, completed)
  VALUES (p_user_id, p_unit_id, p_game_id, v_score, v_correct_count, v_total_questions, p_time_spent_seconds, true)
  RETURNING id INTO v_attempt_id;

  -- Insert incorrect answers
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(v_incorrect_answers) AS x(word text, user_answer text)
  LOOP
    INSERT INTO attempt_incorrect_answers_dictation (attempt_id, incorrect_word, user_answer)
    VALUES (v_attempt_id, v_answer.word, v_answer.user_answer);
  END LOOP;

  -- Calculate average score and time for this specific game (unit + game_id)
  SELECT 
    AVG(score),
    AVG(time_spent_seconds::numeric / NULLIF(total_questions, 0))
  INTO v_avg_score, v_avg_time_per_question
  FROM game_attempts
  WHERE user_id = p_user_id 
    AND unit_id = p_unit_id 
    AND game_id = p_game_id;

  -- Calculate XP based on averages (only if contributes_to_xp)
  IF v_contributes_to_xp THEN
    v_game_xp := GREATEST(0, round(COALESCE(v_avg_score, 0) * 0.5));
    
    IF v_avg_time_per_question IS NOT NULL THEN
      IF v_avg_time_per_question <= 5 THEN
        v_game_xp := v_game_xp + 25;
      ELSIF v_avg_time_per_question < 30 THEN
        v_game_xp := v_game_xp + GREATEST(0, round(25 - (v_avg_time_per_question - 5)));
      END IF;
    END IF;
  ELSE
    v_game_xp := 0;
  END IF;

  -- Update user_progress for this specific game
  SELECT * INTO v_existing_progress 
  FROM user_progress 
  WHERE user_id = p_user_id AND unit_id = p_unit_id AND game_id = p_game_id;
  
  IF v_existing_progress IS NOT NULL THEN
    UPDATE user_progress SET
      attempts = COALESCE(attempts, 0) + 1,
      total_time_seconds = COALESCE(total_time_seconds, 0) + p_time_spent_seconds,
      total_xp = v_game_xp,
      best_score = GREATEST(COALESCE(best_score, 0), v_score),
      completed = completed OR v_is_perfect,
      updated_at = now()
    WHERE id = v_existing_progress.id;
  ELSE
    INSERT INTO user_progress (user_id, unit_id, game_id, best_score, total_xp, total_time_seconds, attempts, completed)
    VALUES (p_user_id, p_unit_id, p_game_id, v_score, v_game_xp, p_time_spent_seconds, 1, v_is_perfect);
  END IF;

  -- Calculate TOTAL XP by summing XP across ALL games (only games that contribute to XP)
  SELECT COALESCE(SUM(up.total_xp), 0) INTO v_total_xp
  FROM user_progress up
  JOIN test_type_games ttg ON ttg.game_id = up.game_id AND ttg.test_type_id = v_test_type_id
  WHERE up.user_id = p_user_id AND ttg.contributes_to_xp = true;

  v_new_level := (v_total_xp / 100) + 1;

  -- Get current streak info from leaderboard table
  SELECT study_streak, last_study_date INTO v_current_streak, v_last_study
  FROM leaderboard WHERE user_id = p_user_id AND test_type_id = v_test_type_id;

  -- Calculate new streak
  v_new_streak := COALESCE(v_current_streak, 0);
  IF v_last_study IS DISTINCT FROM v_today THEN
    IF v_last_study = v_yesterday THEN
      v_new_streak := v_new_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
  END IF;

  -- Update or insert leaderboard entry
  INSERT INTO leaderboard (user_id, test_type_id, total_xp, level, study_streak, last_study_date, updated_at)
  VALUES (p_user_id, v_test_type_id, v_total_xp, v_new_level, v_new_streak, v_today, now())
  ON CONFLICT (user_id, test_type_id) 
  DO UPDATE SET
    total_xp = v_total_xp,
    level = v_new_level,
    study_streak = v_new_streak,
    last_study_date = v_today,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'correct_count', v_correct_count,
    'total_questions', v_total_questions,
    'game_xp', v_game_xp,
    'total_xp', v_total_xp,
    'avg_score', round(COALESCE(v_avg_score, 0)),
    'avg_time_per_question', round(COALESCE(v_avg_time_per_question, 0)),
    'is_perfect', v_is_perfect,
    'attempt_id', v_attempt_id
  );
END;
$$;