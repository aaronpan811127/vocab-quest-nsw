-- Fix validate_game_submission: only set completed=true when score is 100%
-- The game_attempts record stays completed=true (the attempt itself IS complete)
-- But user_progress.completed should only be true when best_score = 100
CREATE OR REPLACE FUNCTION public.validate_game_submission(p_user_id uuid, p_unit_id uuid, p_passage_id uuid, p_game_id uuid, p_answers jsonb, p_time_spent_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_options_length integer;
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

  -- Validate answers array size (prevent DoS with huge arrays)
  IF jsonb_array_length(p_answers) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many answers');
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
      AND game_id = p_game_id;
    
    IF v_question IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid question');
    END IF;
    
    -- SECURITY FIX: Validate answer_index bounds before accessing options array
    v_options_length := jsonb_array_length(COALESCE(v_question.options, '[]'::jsonb));
    IF v_answer.answer_index < 0 OR v_answer.answer_index >= v_options_length THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid answer index');
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

  -- Insert game attempt (the attempt itself is always completed when submitted)
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

  -- Update user_progress
  -- FIXED: Only mark completed when score is perfect (100%)
  -- For test section games, the frontend handles completion via attempt count
  SELECT * INTO v_existing_progress
  FROM user_progress
  WHERE user_id = p_user_id 
    AND unit_id = p_unit_id 
    AND game_id = p_game_id;

  IF v_existing_progress IS NULL THEN
    INSERT INTO user_progress (user_id, unit_id, game_id, best_score, total_xp, attempts, completed, total_time_seconds)
    VALUES (p_user_id, p_unit_id, p_game_id, v_score, v_game_xp, 1, v_is_perfect, p_time_spent_seconds);
  ELSE
    UPDATE user_progress
    SET 
      best_score = GREATEST(best_score, v_score),
      total_xp = v_game_xp,
      attempts = attempts + 1,
      completed = completed OR v_is_perfect,
      total_time_seconds = total_time_seconds + p_time_spent_seconds,
      updated_at = now()
    WHERE user_id = p_user_id 
      AND unit_id = p_unit_id 
      AND game_id = p_game_id;
  END IF;

  -- Calculate total XP across all games for this user and test type
  SELECT COALESCE(SUM(up.total_xp), 0) INTO v_total_xp
  FROM user_progress up
  JOIN test_type_games ttg ON ttg.game_id = up.game_id
  WHERE up.user_id = p_user_id 
    AND ttg.test_type_id = v_test_type_id
    AND ttg.contributes_to_xp = true;

  v_new_level := GREATEST(1, floor(v_total_xp / 100) + 1);

  -- Update streak in leaderboard
  SELECT study_streak, last_study_date INTO v_current_streak, v_last_study
  FROM leaderboard
  WHERE user_id = p_user_id AND test_type_id = v_test_type_id;

  IF v_last_study IS NULL THEN
    v_new_streak := 1;
  ELSIF v_last_study = v_today THEN
    v_new_streak := COALESCE(v_current_streak, 1);
  ELSIF v_last_study = v_yesterday THEN
    v_new_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Update leaderboard
  INSERT INTO leaderboard (user_id, test_type_id, total_xp, level, study_streak, last_study_date)
  VALUES (p_user_id, v_test_type_id, v_total_xp, v_new_level, v_new_streak, v_today)
  ON CONFLICT (user_id, test_type_id) DO UPDATE SET
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
    'xp_earned', v_game_xp,
    'total_xp', v_total_xp,
    'level', v_new_level,
    'streak', v_new_streak,
    'is_perfect', v_is_perfect,
    'attempt_id', v_attempt_id
  );
END;
$function$;