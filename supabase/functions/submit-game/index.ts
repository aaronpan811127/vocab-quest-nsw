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

    // Client with user's JWT to get their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Call the secure database function to validate and process the submission
    const { data, error } = await supabaseAdmin.rpc('validate_game_submission', {
      p_user_id: user.id,
      p_unit_id: unit_id,
      p_passage_id: passage_id,
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
