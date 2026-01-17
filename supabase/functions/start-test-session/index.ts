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
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { unit_id, game_id, total_questions, seconds_per_question } = await req.json();

    if (!unit_id || !game_id || !total_questions || !seconds_per_question) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing completed attempt (test games only allow one attempt)
    const { data: completedAttempts, error: completedError } = await supabase
      .from('game_attempts')
      .select('id, score')
      .eq('user_id', user.id)
      .eq('unit_id', unit_id)
      .eq('game_id', game_id)
      .eq('completed', true);

    if (completedError) throw completedError;

    if (completedAttempts && completedAttempts.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Already completed',
          already_completed: true,
          score: completedAttempts[0].score
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing incomplete session
    const { data: existingSession, error: sessionError } = await supabase
      .from('game_attempts')
      .select('id, started_at, total_duration_seconds')
      .eq('user_id', user.id)
      .eq('unit_id', unit_id)
      .eq('game_id', game_id)
      .eq('completed', false)
      .single();

    if (sessionError && sessionError.code !== 'PGRST116') {
      throw sessionError;
    }

    const totalDuration = total_questions * seconds_per_question;

    if (existingSession) {
      // Return existing session with remaining time
      const startedAt = new Date(existingSession.started_at).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      const remainingSeconds = Math.max(0, (existingSession.total_duration_seconds || totalDuration) - elapsedSeconds);

      return new Response(
        JSON.stringify({
          success: true,
          session_id: existingSession.id,
          started_at: existingSession.started_at,
          total_duration_seconds: existingSession.total_duration_seconds || totalDuration,
          remaining_seconds: remainingSeconds,
          is_expired: remainingSeconds <= 0,
          resumed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new session
    const startedAt = new Date().toISOString();
    const { data: newSession, error: insertError } = await supabase
      .from('game_attempts')
      .insert({
        user_id: user.id,
        unit_id,
        game_id,
        started_at: startedAt,
        total_duration_seconds: totalDuration,
        completed: false,
        score: 0,
        correct_answers: 0,
        total_questions
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        session_id: newSession.id,
        started_at: startedAt,
        total_duration_seconds: totalDuration,
        remaining_seconds: totalDuration,
        is_expired: false,
        resumed: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error starting test session:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
