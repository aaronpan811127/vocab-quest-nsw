import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GameConfig {
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

export interface GroupedGames {
  [sectionCode: string]: {
    sectionName: string;
    sectionDisplayOrder: number;
    games: GameConfig[];
  };
}

export const useGamesConfig = (testTypeId: string | null) => {
  const [games, setGames] = useState<GameConfig[]>([]);
  const [groupedGames, setGroupedGames] = useState<GroupedGames>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testTypeId) {
      setGames([]);
      setGroupedGames({});
      setLoading(false);
      return;
    }

    const fetchGamesConfig = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_test_type_games', {
          p_test_type_id: testTypeId
        });

        if (rpcError) throw rpcError;

        const gamesData = (data || []) as GameConfig[];
        setGames(gamesData);

        // Group games by section
        const grouped: GroupedGames = {};
        gamesData.forEach((game) => {
          if (!grouped[game.section_code]) {
            grouped[game.section_code] = {
              sectionName: game.section_name,
              sectionDisplayOrder: game.section_display_order,
              games: [],
            };
          }
          grouped[game.section_code].games.push(game);
        });

        setGroupedGames(grouped);
      } catch (err) {
        console.error("Error fetching games config:", err);
        setError("Failed to load games configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchGamesConfig();
  }, [testTypeId]);

  // Helper to get game by game_type
  const getGameByType = (gameType: string): GameConfig | undefined => {
    return games.find((g) => g.game_type === gameType);
  };

  // Helper to get game by game_id
  const getGameById = (gameId: string): GameConfig | undefined => {
    return games.find((g) => g.game_id === gameId);
  };

  // Get all games required for unlocking next unit
  const getRequiredGames = (): GameConfig[] => {
    return games.filter((g) => g.required_for_unlock);
  };

  // Get games by section
  const getGamesBySection = (sectionCode: string): GameConfig[] => {
    return groupedGames[sectionCode]?.games || [];
  };

  // Get sections sorted by display order
  const getSortedSections = (): { code: string; name: string; displayOrder: number }[] => {
    return Object.entries(groupedGames)
      .map(([code, data]) => ({
        code,
        name: data.sectionName,
        displayOrder: data.sectionDisplayOrder,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  return {
    games,
    groupedGames,
    loading,
    error,
    getGameByType,
    getGameById,
    getRequiredGames,
    getGamesBySection,
    getSortedSections,
  };
};
