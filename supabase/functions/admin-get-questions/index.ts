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
    const statusParam = url.searchParams.get('status') || 'pending';
    const statusFilters = statusParam.split(',').filter(s => s.trim());
    const gameType = url.searchParams.get('game_type') || 'all';
    const testTypeId = url.searchParams.get('test_type_id') || 'all';
    const unitId = url.searchParams.get('unit_id') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log(`[v3] Admin ${adminUser.id} fetching: game_type=${gameType}, test_type=${testTypeId}, unit=${unitId}, page=${page}`);

    // Game types to exclude from review (no reviewable questions - either no questions or programmatically generated)
    const excludedGameTypes = ['listening', 'matching', 'speaking', 'writing', 'oddoneout'];

    // Get all games first to filter by game_type
    const { data: games } = await supabase.from('games').select('id, name, game_type');
    
    // Get all test types
    const { data: testTypes } = await supabase.from('test_types').select('id, name, code').order('name');
    
    // Get all units with test type info
    const { data: allUnits } = await supabase.from('units').select('id, title, unit_number, test_type_id').order('unit_number');
    
    // Get distinct game types for filter options (excluding non-reviewable types)
    // Return as array of { type, name } objects for proper display names
    const gameTypesWithNames = (games || [])
      .filter(g => !excludedGameTypes.includes(g.game_type))
      .map(g => ({ type: g.game_type, name: g.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Also keep the simple list for backward compatibility
    const gameTypes = gameTypesWithNames.map(g => g.type);

    // If filtering on flashcards, return vocabulary items instead of questions
    // Helper function to fetch vocabulary
    const fetchVocabulary = async () => {
      let vocabQuery = supabase
        .from('vocabulary')
        .select('id, word, definition, synonyms, antonyms, examples, unit_id, created_at, review_status, review_score, reviewed_at, rejection_reason', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Filter by review status (supports multiple statuses)
      if (statusFilters.length > 0 && !statusFilters.includes('all')) {
        vocabQuery = vocabQuery.in('review_status', statusFilters);
      }

      // Filter by test_type_id (via unit's test_type_id)
      if (testTypeId !== 'all' && allUnits) {
        const unitIdsForTestType = allUnits.filter(u => u.test_type_id === testTypeId).map(u => u.id);
        if (unitIdsForTestType.length > 0) {
          vocabQuery = vocabQuery.in('unit_id', unitIdsForTestType);
        }
      }

      // Filter by unit_id
      if (unitId !== 'all') {
        vocabQuery = vocabQuery.eq('unit_id', unitId);
      }

      vocabQuery = vocabQuery.range(offset, offset + limit - 1);

      const { data: vocabulary, count, error: vocabError } = await vocabQuery;

      if (vocabError) {
        console.error('Error fetching vocabulary:', vocabError);
        return { vocabulary: [], count: 0, error: vocabError };
      }

      // Get units for reference
      const { data: units } = await supabase.from('units').select('id, title, unit_number');

      // Enrich vocabulary with unit info
      const enrichedVocabulary = vocabulary?.map(v => {
        const unit = units?.find(u => u.id === v.unit_id);
        return {
          ...v,
          unit_title: unit?.title || 'Unknown',
          unit_number: unit?.unit_number || 0,
        };
      });

      return { vocabulary: enrichedVocabulary || [], count: count || 0, error: null };
    };

    // Return ONLY vocabulary for flashcards filter
    if (gameType === 'flashcards') {
      const { vocabulary: enrichedVocabulary, count, error: vocabError } = await fetchVocabulary();
      
      if (vocabError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch vocabulary' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          vocabulary: enrichedVocabulary,
          questions: [], // Empty questions array for flashcards
          total: count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
          game_types: gameTypes,
          game_types_with_names: gameTypesWithNames,
          test_types: testTypes || [],
          units: allUnits?.map(u => ({ id: u.id, title: u.title, unit_number: u.unit_number, test_type_id: u.test_type_id })) || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for regular questions (not flashcards)
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
      .order('created_at', { ascending: false });

    // Filter by review status (supports multiple statuses)
    if (statusFilters.length > 0 && !statusFilters.includes('all')) {
      query = query.in('review_status', statusFilters);
    }

    // Filter by game_type if specified, always exclude non-reviewable game types
    const excludedGameIds = games?.filter(g => excludedGameTypes.includes(g.game_type)).map(g => g.id) || [];
    
    if (gameType !== 'all' && games) {
      const gameIds = games.filter(g => g.game_type === gameType && !excludedGameTypes.includes(g.game_type)).map(g => g.id);
      if (gameIds.length > 0) {
        query = query.in('game_id', gameIds);
      }
    } else if (excludedGameIds.length > 0) {
      // When showing all, exclude the non-reviewable game types
      const allowedGameIds = games?.filter(g => !excludedGameTypes.includes(g.game_type)).map(g => g.id) || [];
      if (allowedGameIds.length > 0) {
        query = query.in('game_id', allowedGameIds);
      }
    }

    // Filter by test_type_id (via unit's test_type_id)
    if (testTypeId !== 'all' && allUnits) {
      const unitIdsForTestType = allUnits.filter(u => u.test_type_id === testTypeId).map(u => u.id);
      if (unitIdsForTestType.length > 0) {
        query = query.in('unit_id', unitIdsForTestType);
      }
    }

    // Filter by unit_id
    if (unitId !== 'all') {
      query = query.eq('unit_id', unitId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: questions, count, error } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get units for reference
    const { data: units } = await supabase.from('units').select('id, title, unit_number');
    
    // Get passages for reading questions
    const passageIds = questions?.filter(q => q.passage_id).map(q => q.passage_id) || [];
    let passages: Record<string, { title: string; content: string }> = {};
    
    if (passageIds.length > 0) {
      const { data: passageData } = await supabase
        .from('reading_passages')
        .select('id, title, content')
        .in('id', passageIds);
      
      if (passageData) {
        passages = passageData.reduce((acc, p) => {
          acc[p.id] = { title: p.title, content: p.content };
          return acc;
        }, {} as Record<string, { title: string; content: string }>);
      }
    }

    // Enrich questions with unit, game info, and passage content
    const enrichedQuestions = questions?.map(q => {
      const unit = units?.find(u => u.id === q.unit_id);
      const game = games?.find(g => g.id === q.game_id);
      const passage = q.passage_id ? passages[q.passage_id] : null;
      
      return {
        ...q,
        unit_title: unit?.title || 'Unknown',
        unit_number: unit?.unit_number || 0,
        game_name: game?.name || 'Unknown',
        game_type: game?.game_type || 'Unknown',
        passage_title: passage?.title || null,
        passage_content: passage?.content || null,
      };
    });

    // When gameType is 'all', also fetch vocabulary to show alongside questions
    let vocabularyData: unknown[] = [];
    if (gameType === 'all') {
      const { vocabulary: fetchedVocab } = await fetchVocabulary();
      vocabularyData = fetchedVocab;
    }

    return new Response(
      JSON.stringify({ 
        questions: enrichedQuestions,
        vocabulary: vocabularyData,
        total: count,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
        game_types: gameTypes,
        game_types_with_names: gameTypesWithNames,
        test_types: testTypes || [],
        units: allUnits?.map(u => ({ id: u.id, title: u.title, unit_number: u.unit_number, test_type_id: u.test_type_id })) || []
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