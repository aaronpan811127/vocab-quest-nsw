import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { unit_id, game_id, answers, time_spent_seconds } = await req.json();

    // Validate required fields
    if (!unit_id || !game_id || !answers || !Array.isArray(answers) || typeof time_spent_seconds !== 'number') {
      console.error('Invalid request body:', { unit_id, game_id, answers, time_spent_seconds });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate time (1 second to 60 minutes)
    if (time_spent_seconds < 1 || time_spent_seconds > 3600) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid time spent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a test game (max_attempts = 1)
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('id, game_type, rules')
      .eq('id', game_id)
      .single();

    if (gameError || !gameData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid game' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxAttempts = gameData.rules?.max_attempts;

    // Check if user has already attempted this test (single attempt games)
    if (maxAttempts === 1) {
      const { data: existingAttempts, error: attemptError } = await supabase
        .from('game_attempts')
        .select('id')
        .eq('user_id', user.id)
        .eq('unit_id', unit_id)
        .eq('game_id', game_id);

      if (attemptError) {
        console.error('Error checking existing attempts:', attemptError);
        throw attemptError;
      }

      if (existingAttempts && existingAttempts.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'You have already completed this test. Only one attempt is allowed.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get all question IDs from answers
    const questionIds = answers.map((a: { question_id: string }) => a.question_id);

    // Fetch questions with correct answers
    const { data: questions, error: questionsError } = await supabase
      .from('question_bank')
      .select('id, correct_answer, options, word')
      .in('id', questionIds)
      .eq('game_id', game_id);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      throw questionsError;
    }

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid questions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a map for quick lookup
    const questionMap = new Map(questions.map(q => [q.id, q]));

    // Calculate score
    let correctCount = 0;
    const incorrectAnswers: { question_id: string; user_answer: string }[] = [];

    for (const answer of answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid question in answers' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse options to get the user's answer text
      let options: string[];
      try {
        options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
      } catch {
        options = question.options as string[];
      }

      const userAnswerText = options[answer.answer_index];

      if (userAnswerText === question.correct_answer) {
        correctCount++;
      } else {
        incorrectAnswers.push({
          question_id: answer.question_id,
          user_answer: userAnswerText
        });
      }
    }

    const totalQuestions = answers.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const isPerfect = correctCount === totalQuestions;

    // Insert game attempt
    const { data: attemptData, error: attemptInsertError } = await supabase
      .from('game_attempts')
      .insert({
        user_id: user.id,
        unit_id,
        game_id,
        score,
        correct_answers: correctCount,
        total_questions: totalQuestions,
        time_spent_seconds,
        completed: true
      })
      .select('id')
      .single();

    if (attemptInsertError) {
      console.error('Error inserting attempt:', attemptInsertError);
      throw attemptInsertError;
    }

    // Insert incorrect answers for review
    if (incorrectAnswers.length > 0) {
      const incorrectRecords = incorrectAnswers.map(ia => ({
        attempt_id: attemptData.id,
        question_id: ia.question_id,
        user_answer: ia.user_answer
      }));

      const { error: incorrectError } = await supabase
        .from('attempt_incorrect_answers')
        .insert(incorrectRecords);

      if (incorrectError) {
        console.error('Error inserting incorrect answers:', incorrectError);
        // Don't throw - this is not critical
      }
    }

    // Update user_progress (no XP for test games)
    const { data: existingProgress } = await supabase
      .from('user_progress')
      .select('id, attempts, best_score')
      .eq('user_id', user.id)
      .eq('unit_id', unit_id)
      .eq('game_id', game_id)
      .single();

    if (existingProgress) {
      await supabase
        .from('user_progress')
        .update({
          attempts: (existingProgress.attempts || 0) + 1,
          best_score: Math.max(existingProgress.best_score || 0, score),
          total_time_seconds: time_spent_seconds,
          total_xp: 0, // Test games don't give XP
          completed: isPerfect,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id);
    } else {
      await supabase
        .from('user_progress')
        .insert({
          user_id: user.id,
          unit_id,
          game_id,
          best_score: score,
          total_xp: 0,
          total_time_seconds: time_spent_seconds,
          attempts: 1,
          completed: isPerfect
        });
    }

    console.log('Test game submission processed:', {
      user_id: user.id,
      game_id,
      score,
      correct: correctCount,
      total: totalQuestions
    });

    return new Response(
      JSON.stringify({
        success: true,
        score,
        correct_count: correctCount,
        total_questions: totalQuestions,
        is_perfect: isPerfect,
        attempt_id: attemptData.id,
        game_xp: 0, // No XP for test games
        incorrect_count: incorrectAnswers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
