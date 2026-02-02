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
    const activeVocabOnly = url.searchParams.get('active_vocab_only') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log(`[v5] Admin ${adminUser.id} fetching: game_type=${gameType}, test_type=${testTypeId}, unit=${unitId}, active_vocab_only=${activeVocabOnly}, page=${page}`);
    
    // Passage-based game types (no active vocab filtering applies)
    const passageBasedGameTypes = ['reading', 'linked_extracts'];

    // Game types to exclude from review (no reviewable questions - either no questions or programmatically generated)
    const excludedGameTypes = ['listening', 'matching', 'speaking', 'writing', 'oddoneout'];

    // Get all games first to filter by game_type
    const { data: games } = await supabase.from('games').select('id, name, game_type');
    
    // Get all test types (only enabled ones)
    const { data: testTypes } = await supabase.from('test_types').select('id, name, code').eq('is_enabled', true).order('name');
    
    // Get all units with test type info + words (needed for active vocab filtering)
    const { data: allUnits } = await supabase
      .from('units')
      .select('id, title, unit_number, test_type_id, words')
      .order('unit_number');

    // Helper to normalize words for comparison
    const normalizeWord = (w: string) => w.trim().toLowerCase();

    // Helper to parse unit words into a Set for fast lookup
    const getUnitWordsSet = (unitId: string): Set<string> | null => {
      const unit = allUnits?.find(u => u.id === unitId);
      if (!unit || !unit.words) return null;
      
      let wordsArray: string[] = [];
      if (Array.isArray(unit.words)) {
        wordsArray = unit.words.filter((w): w is string => typeof w === 'string');
      } else if (typeof unit.words === 'string') {
        try {
          const parsed = JSON.parse(unit.words);
          if (Array.isArray(parsed)) {
            wordsArray = parsed.filter((w): w is string => typeof w === 'string');
          }
        } catch {
          // Not valid JSON
        }
      }
      
      if (wordsArray.length === 0) return null;
      return new Set(wordsArray.map(normalizeWord));
    };

    // Helper to check if a word is in the unit's active vocab
    const isWordInUnitVocab = (unitId: string, word: string | null | undefined): boolean | null => {
      if (!word) return null; // Can't determine
      const wordsSet = getUnitWordsSet(unitId);
      if (!wordsSet) return null; // No unit words available
      return wordsSet.has(normalizeWord(word));
    };
    
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
    // skipUnitFilter: when true, don't filter by unit_id (used for computing units_with_content)
    const fetchVocabulary = async (skipUnitFilter = false) => {
      // When active_vocab_only is enabled, we need to fetch all matching records first, 
      // filter in memory, then apply pagination
      let vocabQuery = supabase
        .from('vocabulary')
        .select('id, word, definition, synonyms, antonyms, examples, unit_id, created_at, review_status, review_score, reviewed_at, rejection_reason')
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

      // Filter by unit_id (skip when computing units_with_content)
      if (!skipUnitFilter && unitId !== 'all') {
        vocabQuery = vocabQuery.eq('unit_id', unitId);
      }

      const { data: vocabulary, error: vocabError } = await vocabQuery;

      if (vocabError) {
        console.error('Error fetching vocabulary:', vocabError);
        return { vocabulary: [], count: 0, unitsWithContent: [], error: vocabError };
      }

      // Get units for reference
      const { data: units } = await supabase.from('units').select('id, title, unit_number');

      // Enrich vocabulary with unit info
      let enrichedVocabulary = vocabulary?.map(v => {
        const unit = units?.find(u => u.id === v.unit_id);
        return {
          ...v,
          unit_title: unit?.title || 'Unknown',
          unit_number: unit?.unit_number || 0,
        };
      }) || [];

      // Apply active vocab filter if enabled
      if (activeVocabOnly) {
        enrichedVocabulary = enrichedVocabulary.filter(v => {
          const match = isWordInUnitVocab(v.unit_id, v.word);
          // Fail-open: if we can't determine, include it
          if (match === null) return true;
          return match;
        });
      }

      const totalCount = enrichedVocabulary.length;
      
      // Collect unique unit IDs with content (before pagination)
      const unitsWithContent = [...new Set(enrichedVocabulary.map(v => v.unit_id))];
      
      // Apply pagination after filtering
      const paginatedVocabulary = enrichedVocabulary.slice(offset, offset + limit);

      return { vocabulary: paginatedVocabulary, count: totalCount, unitsWithContent, error: null };
    };

    // Return ONLY vocabulary for flashcards filter
    if (gameType === 'flashcards') {
      // Fetch vocabulary for display (with unit filter applied)
      const { vocabulary: enrichedVocabulary, count, error: vocabError } = await fetchVocabulary(false);
      
      // Fetch units with content separately (without unit filter) for dropdown
      const { unitsWithContent } = await fetchVocabulary(true);
      
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
          units: allUnits?.map(u => ({ id: u.id, title: u.title, unit_number: u.unit_number, test_type_id: u.test_type_id, words: u.words })) || [],
          units_with_content: unitsWithContent || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for regular questions (not flashcards)
    // When active_vocab_only is enabled, we fetch all matching records first, filter in memory, then paginate
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
      `)
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

    const { data: questions, error } = await query;

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
    let enrichedQuestions = questions?.map(q => {
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
    }) || [];

    // Check if current game type is passage-based
    const isPassageBasedGame = passageBasedGameTypes.includes(gameType);

    // Apply active vocab filter if enabled (only for non-passage-based games)
    if (activeVocabOnly && !isPassageBasedGame) {
      enrichedQuestions = enrichedQuestions.filter(q => {
        // Prefer explicit word column, fallback to options.word for games like Word Intuition
        let wordToCheck = q.word;
        if (!wordToCheck && q.options) {
          try {
            const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            if (opts && typeof opts === 'object' && 'word' in opts) {
              wordToCheck = opts.word;
            }
          } catch {
            // Ignore parse errors
          }
        }
        
        const match = isWordInUnitVocab(q.unit_id, wordToCheck);
        // Fail-open: if we can't determine, include it
        if (match === null) return true;
        return match;
      });
    }

    // For passage-based games, calculate total passages count
    let totalPassagesCount = 0;
    if (isPassageBasedGame) {
      const passageIds = new Set(enrichedQuestions.filter(q => q.passage_id).map(q => q.passage_id));
      totalPassagesCount = passageIds.size;
    }

    const totalCount = enrichedQuestions.length;
    
    // To get units_with_content, we need unit IDs WITHOUT the unit filter applied
    // Run a separate lightweight query to get distinct unit_ids
    let unitsWithContentQuery = supabase
      .from('question_bank')
      .select('unit_id')
      .order('created_at', { ascending: false });
    
    // Apply same filters EXCEPT unit_id
    if (statusFilters.length > 0 && !statusFilters.includes('all')) {
      unitsWithContentQuery = unitsWithContentQuery.in('review_status', statusFilters);
    }
    if (gameType !== 'all' && games) {
      const gameIds = games.filter(g => g.game_type === gameType && !excludedGameTypes.includes(g.game_type)).map(g => g.id);
      if (gameIds.length > 0) {
        unitsWithContentQuery = unitsWithContentQuery.in('game_id', gameIds);
      }
    } else {
      const allowedGameIds = games?.filter(g => !excludedGameTypes.includes(g.game_type)).map(g => g.id) || [];
      if (allowedGameIds.length > 0) {
        unitsWithContentQuery = unitsWithContentQuery.in('game_id', allowedGameIds);
      }
    }
    if (testTypeId !== 'all' && allUnits) {
      const unitIdsForTestType = allUnits.filter(u => u.test_type_id === testTypeId).map(u => u.id);
      if (unitIdsForTestType.length > 0) {
        unitsWithContentQuery = unitsWithContentQuery.in('unit_id', unitIdsForTestType);
      }
    }
    
    const { data: unitsWithContentData } = await unitsWithContentQuery;
    const questionUnitsWithContent = [...new Set((unitsWithContentData || []).map(q => q.unit_id))];

    // To get game_types_with_content, we need game types WITHOUT the game_type filter applied
    // Run a separate query to get distinct game_ids matching status, test_type, and unit filters
    let gameTypesWithContentQuery = supabase
      .from('question_bank')
      .select('game_id')
      .order('created_at', { ascending: false });
    
    // Apply same filters EXCEPT game_type
    if (statusFilters.length > 0 && !statusFilters.includes('all')) {
      gameTypesWithContentQuery = gameTypesWithContentQuery.in('review_status', statusFilters);
    }
    if (testTypeId !== 'all' && allUnits) {
      const unitIdsForTestType = allUnits.filter(u => u.test_type_id === testTypeId).map(u => u.id);
      if (unitIdsForTestType.length > 0) {
        gameTypesWithContentQuery = gameTypesWithContentQuery.in('unit_id', unitIdsForTestType);
      }
    }
    if (unitId !== 'all') {
      gameTypesWithContentQuery = gameTypesWithContentQuery.eq('unit_id', unitId);
    }
    // Exclude non-reviewable game types
    const allowedGameIdsForQuery = games?.filter(g => !excludedGameTypes.includes(g.game_type)).map(g => g.id) || [];
    if (allowedGameIdsForQuery.length > 0) {
      gameTypesWithContentQuery = gameTypesWithContentQuery.in('game_id', allowedGameIdsForQuery);
    }
    
    const { data: gameTypesWithContentData } = await gameTypesWithContentQuery;
    const gameIdsWithContent = [...new Set((gameTypesWithContentData || []).map(q => q.game_id))];
    // Map game_ids back to game_types
    const gameTypesWithContent = [...new Set(
      gameIdsWithContent
        .map(gid => games?.find(g => g.id === gid)?.game_type)
        .filter((gt): gt is string => !!gt)
    )];
    
    // Apply pagination after filtering
    const paginatedQuestions = enrichedQuestions.slice(offset, offset + limit);

    // When gameType is 'all', also fetch vocabulary to show alongside questions
    let vocabularyData: unknown[] = [];
    let vocabUnitsWithContent: string[] = [];
    if (gameType === 'all') {
      // Fetch for display (with unit filter)
      const { vocabulary: fetchedVocab } = await fetchVocabulary(false);
      vocabularyData = fetchedVocab;
      // Fetch units with content (without unit filter)
      const { unitsWithContent: vocabUnits } = await fetchVocabulary(true);
      vocabUnitsWithContent = vocabUnits;
    }

    // Merge units with content from questions and vocabulary
    const allUnitsWithContent = [...new Set([...questionUnitsWithContent, ...vocabUnitsWithContent])];

    return new Response(
      JSON.stringify({ 
        questions: paginatedQuestions,
        vocabulary: vocabularyData,
        total: totalCount,
        total_passages: totalPassagesCount,
        is_passage_based: isPassageBasedGame,
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
        game_types: gameTypes,
        game_types_with_names: gameTypesWithNames,
        game_types_with_content: gameTypesWithContent,
        test_types: testTypes || [],
        units: allUnits?.map(u => ({ id: u.id, title: u.title, unit_number: u.unit_number, test_type_id: u.test_type_id, words: u.words })) || [],
        units_with_content: allUnitsWithContent
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