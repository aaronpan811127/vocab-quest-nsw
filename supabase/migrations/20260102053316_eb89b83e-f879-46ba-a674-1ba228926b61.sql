
-- Fix XP calculation: use average score and time per game, then sum across games
CREATE OR REPLACE FUNCTION public.validate_game_submission(p_user_id uuid, p_unit_id uuid, p_passage_id uuid, p_answers jsonb, p_time_spent_seconds integer)
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
  v_game_type text := 'reading';
  v_game_record record;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid user');
  END IF;

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

  -- Insert game attempt FIRST (so it's included in average calculation)
  INSERT INTO game_attempts (user_id, unit_id, passage_id, game_type, score, correct_answers, total_questions, time_spent_seconds, completed)
  VALUES (p_user_id, p_unit_id, p_passage_id, v_game_type, v_score, v_correct_count, v_total_questions, p_time_spent_seconds, true)
  RETURNING id INTO v_attempt_id;

  -- Insert incorrect answers
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(v_incorrect_answers) AS x(question_id uuid, user_answer text)
  LOOP
    INSERT INTO attempt_incorrect_answers (attempt_id, question_id, user_answer)
    VALUES (v_attempt_id, v_answer.question_id, v_answer.user_answer);
  END LOOP;

  -- Calculate average score and time for THIS specific game (unit + game_type)
  SELECT 
    AVG(score),
    AVG(time_spent_seconds::numeric / NULLIF(total_questions, 0))
  INTO v_avg_score, v_avg_time_per_question
  FROM game_attempts
  WHERE user_id = p_user_id 
    AND unit_id = p_unit_id 
    AND game_type = v_game_type;

  -- Calculate XP for THIS game based on averages
  v_game_xp := GREATEST(0, round(COALESCE(v_avg_score, 0) * 0.5));
  
  IF v_avg_time_per_question IS NOT NULL THEN
    IF v_avg_time_per_question <= 5 THEN
      v_game_xp := v_game_xp + 25;
    ELSIF v_avg_time_per_question < 30 THEN
      v_game_xp := v_game_xp + GREATEST(0, round(25 - (v_avg_time_per_question - 5)));
    END IF;
  END IF;

  -- Update user_progress for this specific game
  SELECT * INTO v_existing_progress 
  FROM user_progress 
  WHERE user_id = p_user_id AND unit_id = p_unit_id AND game_type = v_game_type;
  
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
    INSERT INTO user_progress (user_id, unit_id, game_type, best_score, total_xp, total_time_seconds, attempts, completed)
    VALUES (p_user_id, p_unit_id, v_game_type, v_score, v_game_xp, p_time_spent_seconds, 1, v_is_perfect);
  END IF;

  -- Calculate TOTAL XP by summing XP across ALL games (different unit+game_type combinations)
  SELECT COALESCE(SUM(total_xp), 0) INTO v_total_xp
  FROM user_progress
  WHERE user_id = p_user_id;

  v_new_level := (v_total_xp / 100) + 1;

  -- Get current streak info
  SELECT study_streak, last_study_date INTO v_current_streak, v_last_study
  FROM profiles WHERE user_id = p_user_id;

  -- Calculate new streak
  v_new_streak := COALESCE(v_current_streak, 0);
  IF v_last_study IS DISTINCT FROM v_today THEN
    IF v_last_study = v_yesterday THEN
      v_new_streak := v_new_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
  END IF;

  -- Update profile with total XP from all games
  UPDATE profiles SET
    total_xp = v_total_xp,
    level = v_new_level,
    last_study_date = v_today,
    study_streak = v_new_streak,
    updated_at = now()
  WHERE user_id = p_user_id;

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
$function$;
