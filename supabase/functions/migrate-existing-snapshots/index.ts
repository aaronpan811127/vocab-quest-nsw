import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GameConfig {
  game_id: string;
  game_type: string;
  game_name: string;
  description: string;
  icon_name: string;
  rules: Record<string, unknown>;
  section_id: string;
  section_code: string;
  section_name: string;
  section_display_order: number;
  display_order: number;
  contributes_to_xp: boolean;
  required_for_unlock: boolean;
}

/**
 * Migration function to create snapshots for all existing users with progress.
 * This should be called once to migrate existing users.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all unique user_id + unit_id combinations from user_progress
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('user_id, unit_id')
      .limit(10000); // Batch limit

    if (progressError) throw progressError;

    // Get unique combinations
    const uniqueCombos = new Map<string, { user_id: string; unit_id: string }>();
    progressData?.forEach((p) => {
      const key = `${p.user_id}:${p.unit_id}`;
      if (!uniqueCombos.has(key)) {
        uniqueCombos.set(key, { user_id: p.user_id, unit_id: p.unit_id });
      }
    });

    console.log(`Found ${uniqueCombos.size} unique user-unit combinations to migrate`);

    // Get existing snapshots to avoid duplicates
    const { data: existingSnapshots, error: snapError } = await supabase
      .from('user_unit_game_snapshots')
      .select('user_id, unit_id');

    if (snapError) throw snapError;

    const existingKeys = new Set(
      existingSnapshots?.map((s) => `${s.user_id}:${s.unit_id}`) || []
    );

    // Get unit -> test_type mapping
    const { data: unitsData, error: unitsError } = await supabase
      .from('units')
      .select('id, test_type_id');

    if (unitsError) throw unitsError;

    const unitTestTypeMap = new Map<string, string>();
    unitsData?.forEach((u) => {
      if (u.test_type_id) {
        unitTestTypeMap.set(u.id, u.test_type_id);
      }
    });

    // Cache for game configs by test_type_id
    const gameConfigCache = new Map<string, GameConfig[]>();

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process each unique combination
    for (const [key, combo] of uniqueCombos) {
      // Skip if already exists
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const testTypeId = unitTestTypeMap.get(combo.unit_id);
      if (!testTypeId) {
        console.log(`No test_type_id found for unit ${combo.unit_id}`);
        skipped++;
        continue;
      }

      // Get or fetch game config for this test type
      let gamesConfig = gameConfigCache.get(testTypeId);
      if (!gamesConfig) {
        const { data: gamesData, error: gamesError } = await supabase.rpc('get_test_type_games', {
          p_test_type_id: testTypeId
        });

        if (gamesError) {
          console.error(`Error fetching games for test type ${testTypeId}:`, gamesError);
          errors++;
          continue;
        }

        gamesConfig = (gamesData || []).map((game: any) => ({
          game_id: game.game_id,
          game_type: game.game_type,
          game_name: game.game_name,
          description: game.description || '',
          icon_name: game.icon_name || '',
          rules: game.rules || {},
          section_id: game.section_id,
          section_code: game.section_code,
          section_name: game.section_name,
          section_display_order: game.section_display_order,
          display_order: game.display_order,
          contributes_to_xp: game.contributes_to_xp,
          required_for_unlock: game.required_for_unlock,
        }));

        gameConfigCache.set(testTypeId, gamesConfig);
      }

      // Create snapshot
      const { error: insertError } = await supabase
        .from('user_unit_game_snapshots')
        .insert({
          user_id: combo.user_id,
          unit_id: combo.unit_id,
          test_type_id: testTypeId,
          games_config: gamesConfig
        });

      if (insertError) {
        if (insertError.code === '23505') {
          // Duplicate - already exists (race condition)
          skipped++;
        } else {
          console.error(`Error creating snapshot for ${key}:`, insertError);
          errors++;
        }
      } else {
        created++;
      }
    }

    console.log(`Migration complete: created=${created}, skipped=${skipped}, errors=${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        errors,
        total: uniqueCombos.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in migrate-existing-snapshots:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
