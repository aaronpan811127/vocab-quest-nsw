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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth client to get user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { unit_id, test_type_id } = await req.json();

    if (!unit_id || !test_type_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing unit_id or test_type_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if snapshot already exists
    const { data: existingSnapshot, error: snapshotError } = await supabase
      .from('user_unit_game_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .eq('unit_id', unit_id)
      .maybeSingle();

    if (snapshotError) {
      console.error('Error checking existing snapshot:', snapshotError);
      throw snapshotError;
    }

    // If snapshot exists, return it
    if (existingSnapshot) {
      return new Response(
        JSON.stringify({
          success: true,
          snapshot: existingSnapshot,
          created: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Snapshot doesn't exist, create one by fetching current game config and unit config
    const [gamesResult, unitResult] = await Promise.all([
      supabase.rpc('get_test_type_games', { p_test_type_id: test_type_id }),
      supabase.from('units').select('title, description, words, unit_number').eq('id', unit_id).single()
    ]);

    if (gamesResult.error) {
      console.error('Error fetching games config:', gamesResult.error);
      throw gamesResult.error;
    }

    if (unitResult.error) {
      console.error('Error fetching unit config:', unitResult.error);
      throw unitResult.error;
    }

    const gamesConfig: GameConfig[] = (gamesResult.data || []).map((game: any) => ({
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

    // Capture unit config at the time of snapshot creation
    const unitConfig = {
      title: unitResult.data.title,
      description: unitResult.data.description,
      words: unitResult.data.words,
      unit_number: unitResult.data.unit_number,
    };

    // Insert the new snapshot
    const { data: newSnapshot, error: insertError } = await supabase
      .from('user_unit_game_snapshots')
      .insert({
        user_id: user.id,
        unit_id,
        test_type_id,
        games_config: gamesConfig,
        unit_config: unitConfig
      })
      .select()
      .single();

    if (insertError) {
      // Handle race condition - another request might have created it
      if (insertError.code === '23505') { // Unique violation
        const { data: raceSnapshot } = await supabase
          .from('user_unit_game_snapshots')
          .select('*')
          .eq('user_id', user.id)
          .eq('unit_id', unit_id)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            snapshot: raceSnapshot,
            created: false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Error creating snapshot:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot: newSnapshot,
        created: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-or-create-game-snapshot:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
