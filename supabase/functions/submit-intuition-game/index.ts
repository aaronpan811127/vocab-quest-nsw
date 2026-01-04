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

    const { unit_id, score, correct_answers, total_questions, time_spent_seconds, incorrect_answers } = await req.json();

    // Validate required fields
    if (!unit_id || typeof score !== 'number' || typeof correct_answers !== 'number' || 
        typeof total_questions !== 'number' || typeof time_spent_seconds !== 'number') {
      console.error('Invalid request body:', { unit_id, score, correct_answers, total_questions, time_spent_seconds });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate time is reasonable (1 second to 30 minutes)
    if (time_spent_seconds < 1 || time_spent_seconds > 1800) {
      console.error('Invalid time spent:', time_spent_seconds);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid time spent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Insert game attempt
    const { data: attemptData, error: attemptError } = await supabaseAdmin
      .from('game_attempts')
      .insert({
        user_id: user.id,
        unit_id,
        game_type: 'intuition',
        score,
        correct_answers,
        total_questions,
        time_spent_seconds,
        completed: true
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Insert attempt error:', attemptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save game attempt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate XP based on score
    const baseXp = Math.round(score * 0.5);
    const timeBonus = time_spent_seconds <= 5 * total_questions ? 25 : 
                      time_spent_seconds < 30 * total_questions ? Math.max(0, 25 - Math.round((time_spent_seconds / total_questions - 5))) : 0;
    const gameXp = baseXp + timeBonus;

    // Update user progress
    const { data: existingProgress } = await supabaseAdmin
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('unit_id', unit_id)
      .eq('game_type', 'intuition')
      .maybeSingle();

    if (existingProgress) {
      await supabaseAdmin
        .from('user_progress')
        .update({
          attempts: (existingProgress.attempts || 0) + 1,
          total_time_seconds: (existingProgress.total_time_seconds || 0) + time_spent_seconds,
          total_xp: gameXp,
          best_score: Math.max(existingProgress.best_score || 0, score),
          completed: existingProgress.completed || score === 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id);
    } else {
      await supabaseAdmin
        .from('user_progress')
        .insert({
          user_id: user.id,
          unit_id,
          game_type: 'intuition',
          best_score: score,
          total_xp: gameXp,
          total_time_seconds: time_spent_seconds,
          attempts: 1,
          completed: score === 100
        });
    }

    // Calculate total XP across all games
    const { data: allProgress } = await supabaseAdmin
      .from('user_progress')
      .select('total_xp')
      .eq('user_id', user.id);

    const totalXp = allProgress?.reduce((sum, p) => sum + (p.total_xp || 0), 0) || 0;
    const newLevel = Math.floor(totalXp / 100) + 1;

    // Get user's default test type
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('default_test_type_id')
      .eq('user_id', user.id)
      .single();

    const testTypeId = profile?.default_test_type_id;

    if (testTypeId) {
      // Update leaderboard
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const { data: leaderboardEntry } = await supabaseAdmin
        .from('leaderboard')
        .select('study_streak, last_study_date')
        .eq('user_id', user.id)
        .eq('test_type_id', testTypeId)
        .maybeSingle();

      let newStreak = leaderboardEntry?.study_streak || 0;
      const lastStudy = leaderboardEntry?.last_study_date;

      if (lastStudy !== today) {
        if (lastStudy === yesterday) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }

      await supabaseAdmin
        .from('leaderboard')
        .upsert({
          user_id: user.id,
          test_type_id: testTypeId,
          total_xp: totalXp,
          level: newLevel,
          study_streak: newStreak,
          last_study_date: today,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,test_type_id' });
    }

    console.log('Intuition game submission processed:', { score, gameXp, totalXp });
    
    return new Response(
      JSON.stringify({
        success: true,
        score,
        xpEarned: gameXp,
        totalXp,
        level: newLevel
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
