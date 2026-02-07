import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header to extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('User auth error:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    // Parse request body
    const { unit_id, passage_id, answers, time_spent_seconds } = await req.json();

    // Validate required fields
    if (!unit_id || !passage_id || !answers || !Array.isArray(answers) || typeof time_spent_seconds !== 'number') {
      console.error('Invalid request body:', { unit_id, passage_id, answers, time_spent_seconds });
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

    // Client with service role to call the secure function
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the game_id for 'reading' game type
    const { data: gameData, error: gameError } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('game_type', 'reading')
      .single();

    if (gameError || !gameData) {
      console.error('Failed to find reading game:', gameError);
      return new Response(
        JSON.stringify({ success: false, error: 'Reading game configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using game_id:', gameData.id);

    // Call the secure database function to validate and process the submission
    const { data, error } = await supabaseAdmin.rpc('validate_game_submission', {
      p_user_id: user.id,
      p_unit_id: unit_id,
      p_passage_id: passage_id,
      p_game_id: gameData.id,
      p_answers: answers,
      p_time_spent_seconds: time_spent_seconds
    });

    if (error) {
      console.error('Database function error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process submission' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Game submission processed:', data);
    return new Response(
      JSON.stringify(data),
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
