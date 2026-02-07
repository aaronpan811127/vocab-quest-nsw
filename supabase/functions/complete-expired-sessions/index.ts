import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate user token using getClaims
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.log('Auth validation failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all incomplete test sessions for this user
    const { data: incompleteSessions, error: fetchError } = await supabase
      .from('game_attempts')
      .select('id, game_id, unit_id, started_at, total_duration_seconds, total_questions')
      .eq('user_id', userId)
      .eq('completed', false)
      .not('started_at', 'is', null);

    if (fetchError) throw fetchError;

    if (!incompleteSessions || incompleteSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, completed_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const session of incompleteSessions) {
      if (!session.started_at || !session.total_duration_seconds) continue;

      const startedAt = new Date(session.started_at).getTime();
      const expiresAt = startedAt + (session.total_duration_seconds * 1000);

      if (now >= expiresAt) {
        expiredSessions.push(session.id);

        const timeSpentSeconds = session.total_duration_seconds;
        
        await supabase
          .from('game_attempts')
          .update({
            completed: true,
            score: 0,
            correct_answers: 0,
            time_spent_seconds: timeSpentSeconds
          })
          .eq('id', session.id);

        const { data: existingProgress } = await supabase
          .from('user_progress')
          .select('id, attempts, best_score')
          .eq('user_id', userId)
          .eq('unit_id', session.unit_id)
          .eq('game_id', session.game_id)
          .single();

        if (existingProgress) {
          await supabase
            .from('user_progress')
            .update({
              attempts: (existingProgress.attempts || 0) + 1,
              best_score: Math.max(existingProgress.best_score || 0, 0),
              total_time_seconds: timeSpentSeconds,
              completed: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProgress.id);
        } else {
          await supabase
            .from('user_progress')
            .insert({
              user_id: userId,
              unit_id: session.unit_id,
              game_id: session.game_id,
              best_score: 0,
              total_xp: 0,
              total_time_seconds: timeSpentSeconds,
              attempts: 1,
              completed: false
            });
        }
      }
    }

    console.log('Completed expired sessions:', expiredSessions.length);

    return new Response(
      JSON.stringify({
        success: true,
        completed_count: expiredSessions.length,
        completed_session_ids: expiredSessions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error completing expired sessions:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
