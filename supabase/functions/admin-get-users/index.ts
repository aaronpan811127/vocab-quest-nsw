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

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log(`Admin ${adminUser.id} fetching users, search: ${search}, page: ${page}`);

    // Get profiles with their progress
    let query = supabase
      .from('profiles')
      .select(`
        id,
        user_id,
        username,
        avatar_url,
        current_unit_id,
        default_test_type_id,
        created_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('username', `%${search}%`);
    }

    const { data: profiles, count, error } = await query;

    if (error) {
      console.error('Error fetching profiles:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get leaderboard data for these users
    const userIds = profiles?.map(p => p.user_id) || [];
    
    const { data: leaderboardData } = await supabase
      .from('leaderboard')
      .select('user_id, total_xp, level, study_streak, test_type_id')
      .in('user_id', userIds);

    // Get units for reference
    const { data: units } = await supabase.from('units').select('id, title, unit_number');

    // Get user progress (in-progress units)
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('user_id, unit_id, completed')
      .in('user_id', userIds);

    // Enrich profiles
    const enrichedProfiles = profiles?.map(p => {
      const leaderboard = leaderboardData?.find(l => l.user_id === p.user_id);
      const currentUnit = units?.find(u => u.id === p.current_unit_id);
      
      // Find units with in-progress games for this user
      const userProgress = progressData?.filter(pr => pr.user_id === p.user_id) || [];
      const unitProgress: Record<string, { total: number; completed: number }> = {};
      
      userProgress.forEach(pr => {
        if (!unitProgress[pr.unit_id]) {
          unitProgress[pr.unit_id] = { total: 0, completed: 0 };
        }
        unitProgress[pr.unit_id].total++;
        if (pr.completed) {
          unitProgress[pr.unit_id].completed++;
        }
      });

      const inProgressUnits = Object.entries(unitProgress)
        .filter(([_, progress]) => progress.total > 0 && progress.completed < progress.total)
        .map(([unitId, progress]) => {
          const unit = units?.find(u => u.id === unitId);
          return {
            unit_id: unitId,
            unit_title: unit?.title || 'Unknown',
            unit_number: unit?.unit_number || 0,
            games_completed: progress.completed,
            games_total: progress.total
          };
        });

      return {
        ...p,
        total_xp: leaderboard?.total_xp || 0,
        level: leaderboard?.level || 1,
        study_streak: leaderboard?.study_streak || 0,
        current_unit_title: currentUnit?.title || null,
        current_unit_number: currentUnit?.unit_number || null,
        in_progress_units: inProgressUnits
      };
    });

    return new Response(
      JSON.stringify({ 
        users: enrichedProfiles,
        total: count,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-get-users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
