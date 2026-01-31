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
    const status = url.searchParams.get('status') || 'pending';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log(`Admin ${adminUser.id} fetching questions with status: ${status}, page: ${page}`);

    // Get questions with pagination
    let query = supabase
      .from('question_bank')
      .select(`
        id,
        question_text,
        correct_answer,
        options,
        word,
        review_status,
        review_score,
        reviewed_at,
        rejection_reason,
        created_at,
        unit_id,
        game_id,
        passage_id
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('review_status', status);
    }

    const { data: questions, count, error } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get units and games for reference
    const { data: units } = await supabase.from('units').select('id, title, unit_number');
    const { data: games } = await supabase.from('games').select('id, name, game_type');

    // Enrich questions with unit and game info
    const enrichedQuestions = questions?.map(q => {
      const unit = units?.find(u => u.id === q.unit_id);
      const game = games?.find(g => g.id === q.game_id);
      return {
        ...q,
        unit_title: unit?.title || 'Unknown',
        unit_number: unit?.unit_number || 0,
        game_name: game?.name || 'Unknown',
        game_type: game?.game_type || 'Unknown'
      };
    });

    return new Response(
      JSON.stringify({ 
        questions: enrichedQuestions,
        total: count,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-get-questions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
