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

    const { unit_id, score, correct_answers, total_questions, time_spent_seconds } = await req.json();

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

    // Insert game attempt only - NO XP accumulation for intuition game
    const { error: attemptError } = await supabaseAdmin
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
      });

    if (attemptError) {
      console.error('Insert attempt error:', attemptError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save game attempt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Intuition game attempt saved (no XP):', { score, correct_answers, total_questions });
    
    return new Response(
      JSON.stringify({
        success: true,
        score,
        xpEarned: 0 // No XP for practice games
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
