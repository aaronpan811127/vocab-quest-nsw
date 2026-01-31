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

    // Get units with test type info
    const { data: units } = await supabase
      .from('units')
      .select('id, title, unit_number, test_type_id');

    // Get test types for reference
    const { data: testTypes } = await supabase.from('test_types').select('id, name, code');

    // Get test_type_games to know required games per test type
    const { data: testTypeGames } = await supabase
      .from('test_type_games')
      .select('test_type_id, game_id, required_for_unlock')
      .eq('is_enabled', true);

    // Build a map of test_type_id -> required game count
    const requiredGamesPerTestType: Record<string, number> = {};
    testTypeGames?.forEach(ttg => {
      if (ttg.required_for_unlock) {
        requiredGamesPerTestType[ttg.test_type_id] = (requiredGamesPerTestType[ttg.test_type_id] || 0) + 1;
      }
    });

    // Get user progress (in-progress units)
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('user_id, unit_id, game_id, completed')
      .in('user_id', userIds);

    // Get required game IDs per test type for accurate counting
    const requiredGameIdsPerTestType: Record<string, Set<string>> = {};
    testTypeGames?.forEach(ttg => {
      if (ttg.required_for_unlock) {
        if (!requiredGameIdsPerTestType[ttg.test_type_id]) {
          requiredGameIdsPerTestType[ttg.test_type_id] = new Set();
        }
        requiredGameIdsPerTestType[ttg.test_type_id].add(ttg.game_id);
      }
    });

    // Enrich profiles
    const enrichedProfiles = profiles?.map(p => {
      const leaderboard = leaderboardData?.find(l => l.user_id === p.user_id);
      const currentUnit = units?.find(u => u.id === p.current_unit_id);
      const testType = testTypes?.find(t => t.id === p.default_test_type_id);
      
      // Find units with in-progress games for this user
      const userProgress = progressData?.filter(pr => pr.user_id === p.user_id) || [];
      
      // Group progress by unit_id
      const unitProgressMap: Record<string, { completed: Set<string>; all: Set<string> }> = {};
      
      userProgress.forEach(pr => {
        if (!unitProgressMap[pr.unit_id]) {
          unitProgressMap[pr.unit_id] = { completed: new Set(), all: new Set() };
        }
        unitProgressMap[pr.unit_id].all.add(pr.game_id);
        if (pr.completed) {
          unitProgressMap[pr.unit_id].completed.add(pr.game_id);
        }
      });

      // Build in-progress units list with correct total games from test_type_games
      const inProgressUnits: Array<{
        unit_id: string;
        unit_title: string;
        unit_number: number;
        test_type_id: string;
        test_type_name: string;
        games_completed: number;
        games_total: number;
      }> = [];

      Object.entries(unitProgressMap).forEach(([unitId, progress]) => {
        const unit = units?.find(u => u.id === unitId);
        if (!unit || !unit.test_type_id) return;

        const unitTestType = testTypes?.find(t => t.id === unit.test_type_id);
        const requiredGameIds = requiredGameIdsPerTestType[unit.test_type_id];
        const totalRequiredGames = requiredGamesPerTestType[unit.test_type_id] || 0;

        if (!requiredGameIds || totalRequiredGames === 0) return;

        // Count completed required games only
        let completedRequiredGames = 0;
        progress.completed.forEach(gameId => {
          if (requiredGameIds.has(gameId)) {
            completedRequiredGames++;
          }
        });

        // Only show as in-progress if started but not completed
        if (progress.all.size > 0 && completedRequiredGames < totalRequiredGames) {
          inProgressUnits.push({
            unit_id: unitId,
            unit_title: unit.title || 'Unknown',
            unit_number: unit.unit_number || 0,
            test_type_id: unit.test_type_id,
            test_type_name: unitTestType?.name || 'Unknown',
            games_completed: completedRequiredGames,
            games_total: totalRequiredGames
          });
        }
      });

      // Sort by test type name, then unit number
      inProgressUnits.sort((a, b) => {
        if (a.test_type_name !== b.test_type_name) {
          return a.test_type_name.localeCompare(b.test_type_name);
        }
        return a.unit_number - b.unit_number;
      });

      return {
        ...p,
        total_xp: leaderboard?.total_xp || 0,
        level: leaderboard?.level || 1,
        study_streak: leaderboard?.study_streak || 0,
        test_type_name: testType?.name || null,
        test_type_code: testType?.code || null,
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
