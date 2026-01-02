
-- Drop and recreate the validate_game_submission function with new XP calculation
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
  v_xp_earned integer := 0;
  v_is_perfect boolean;
  v_attempt_id uuid;
  v_answer record;
  v_question record;
  v_user_answer text;
  v_profile record;
  v_new_xp integer;
  v_new_level integer;
  v_new_streak integer;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
  v_existing_progress record;
  v_incorrect_answers jsonb := '[]'::jsonb;
  v_avg_score numeric;
  v_avg_time_per_question numeric;
  v_total_attempts integer;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid user');
  END IF;

  -- Process each answer
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_id uuid, answer_index integer)
  LOOP
    -- Get the question and verify it belongs to the passage
    SELECT * INTO v_question 
    FROM question_bank 
    WHERE id = v_answer.question_id 
      AND passage_id = p_passage_id
      AND game_type = 'reading';
    
    IF v_question IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid question');
    END IF;
    
    v_total_questions := v_total_questions + 1;
    
    -- Get the user's answer text from options array
    v_user_answer := v_question.options->>v_answer.answer_index;
    
    IF v_user_answer = v_question.correct_answer THEN
      v_correct_count := v_correct_count + 1;
    ELSE
      -- Track incorrect answers
      v_incorrect_answers := v_incorrect_answers || jsonb_build_object(
        'question_id', v_answer.question_id,
        'user_answer', v_user_answer
      );
    END IF;
  END LOOP;

  IF v_total_questions = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid answers provided');
  END IF;

  -- Calculate score for this attempt
  v_score := round((v_correct_count::numeric / v_total_questions::numeric) * 100);
  v_is_perfect := v_correct_count = v_total_questions;

  -- Insert game attempt first (so it's included in stats calculation)
  INSERT INTO game_attempts (user_id, unit_id, passage_id, game_type, score, correct_answers, total_questions, time_spent_seconds, completed)
  VALUES (p_user_id, p_unit_id, p_passage_id, 'reading', v_score, v_correct_count, v_total_questions, p_time_spent_seconds, true)
  RETURNING id INTO v_attempt_id;

  -- Insert incorrect answers
  FOR v_answer IN SELECT * FROM jsonb_to_recordset(v_incorrect_answers) AS x(question_id uuid, user_answer text)
  LOOP
    INSERT INTO attempt_incorrect_answers (attempt_id, question_id, user_answer)
    VALUES (v_attempt_id, v_answer.question_id, v_answer.user_answer);
  END LOOP;

  -- Calculate XP based on average score and average time per question across ALL attempts
  SELECT 
    COUNT(*),
    AVG(score),
    AVG(time_spent_seconds::numeric / NULLIF(total_questions, 0))
  INTO v_total_attempts, v_avg_score, v_avg_time_per_question
  FROM game_attempts
  WHERE user_id = p_user_id;

  -- XP Formula: (avg_score * 0.5) + time_bonus
  -- Time bonus: faster avg time = more XP (max 25 bonus for <5s/question, 0 bonus for >30s/question)
  v_xp_earned := GREATEST(0, round(COALESCE(v_avg_score, 0) * 0.5));
  
  -- Add time bonus: 25 - (avg_time_per_question - 5) for times between 5-30 seconds
  IF v_avg_time_per_question IS NOT NULL THEN
    IF v_avg_time_per_question <= 5 THEN
      v_xp_earned := v_xp_earned + 25;
    ELSIF v_avg_time_per_question >= 30 THEN
      v_xp_earned := v_xp_earned + 0;
    ELSE
      v_xp_earned := v_xp_earned + GREATEST(0, round(25 - (v_avg_time_per_question - 5)));
    END IF;
  END IF;

  -- Update user profile with new total XP
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  
  IF v_profile IS NOT NULL THEN
    v_new_xp := v_xp_earned;
    v_new_level := (v_new_xp / 100) + 1;
    
    -- Calculate streak
    v_new_streak := COALESCE(v_profile.study_streak, 0);
    IF v_profile.last_study_date IS DISTINCT FROM v_today THEN
      IF v_profile.last_study_date = v_yesterday THEN
        v_new_streak := v_new_streak + 1;
      ELSE
        v_new_streak := 1;
      END IF;
    END IF;
    
    UPDATE profiles SET
      total_xp = v_new_xp,
      level = v_new_level,
      last_study_date = v_today,
      study_streak = v_new_streak,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Update or create user_progress
  SELECT * INTO v_existing_progress FROM user_progress WHERE user_id = p_user_id AND unit_id = p_unit_id;
  
  IF v_existing_progress IS NOT NULL THEN
    UPDATE user_progress SET
      attempts = COALESCE(attempts, 0) + 1,
      time_spent_minutes = COALESCE(time_spent_minutes, 0) + CEIL(p_time_spent_seconds::numeric / 60),
      reading_score = GREATEST(COALESCE(reading_score, 0), v_score),
      reading_completed = reading_completed OR v_is_perfect,
      updated_at = now()
    WHERE id = v_existing_progress.id;
  ELSE
    INSERT INTO user_progress (user_id, unit_id, reading_score, reading_completed, attempts, time_spent_minutes)
    VALUES (p_user_id, p_unit_id, v_score, v_is_perfect, 1, CEIL(p_time_spent_seconds::numeric / 60));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'correct_count', v_correct_count,
    'total_questions', v_total_questions,
    'xp_earned', v_xp_earned,
    'is_perfect', v_is_perfect,
    'attempt_id', v_attempt_id,
    'avg_score', round(COALESCE(v_avg_score, 0)),
    'avg_time_per_question', round(COALESCE(v_avg_time_per_question, 0))
  );
END;
$function$;
