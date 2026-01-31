import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get admin user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { p_user_id: adminUser.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { target_user_id, unit_id } = await req.json();

    if (!target_user_id || !unit_id) {
      return new Response(
        JSON.stringify({ error: 'Missing target_user_id or unit_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${adminUser.id} resetting unit ${unit_id} for user ${target_user_id}`);

    // Get all game attempt IDs for this user/unit to delete related records
    const { data: attempts } = await supabase
      .from('game_attempts')
      .select('id')
      .eq('user_id', target_user_id)
      .eq('unit_id', unit_id);

    const attemptIds = attempts?.map(a => a.id) || [];

    // Delete incorrect answers for these attempts
    if (attemptIds.length > 0) {
      await supabase
        .from('attempt_incorrect_answers')
        .delete()
        .in('attempt_id', attemptIds);

      await supabase
        .from('attempt_incorrect_answers_dictation')
        .delete()
        .in('attempt_id', attemptIds);
    }

    // Delete game attempts
    await supabase
      .from('game_attempts')
      .delete()
      .eq('user_id', target_user_id)
      .eq('unit_id', unit_id);

    // Delete user progress for this unit
    await supabase
      .from('user_progress')
      .delete()
      .eq('user_id', target_user_id)
      .eq('unit_id', unit_id);

    // Delete game snapshot for this unit
    await supabase
      .from('user_unit_game_snapshots')
      .delete()
      .eq('user_id', target_user_id)
      .eq('unit_id', unit_id);

    // Recalculate total XP for leaderboard
    // First, get the user's test type
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_test_type_id')
      .eq('user_id', target_user_id)
      .single();

    const testTypeId = profile?.default_test_type_id;

    if (testTypeId) {
      // Get games that contribute to XP
      const { data: xpGames } = await supabase
        .from('test_type_games')
        .select('game_id')
        .eq('test_type_id', testTypeId)
        .eq('contributes_to_xp', true);

      const xpGameIds = xpGames?.map(g => g.game_id) || [];

      // Calculate new total XP
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('total_xp, game_id')
        .eq('user_id', target_user_id);

      const newTotalXp = progressData?.reduce((sum, p) => {
        if (xpGameIds.includes(p.game_id)) {
          return sum + (p.total_xp || 0);
        }
        return sum;
      }, 0) || 0;

      const newLevel = Math.floor(newTotalXp / 100) + 1;

      // Update leaderboard
      await supabase
        .from('leaderboard')
        .update({
          total_xp: newTotalXp,
          level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', target_user_id)
        .eq('test_type_id', testTypeId);
    }

    console.log(`Successfully reset unit ${unit_id} for user ${target_user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Unit reset successfully',
        deleted_attempts: attemptIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-user-unit:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
