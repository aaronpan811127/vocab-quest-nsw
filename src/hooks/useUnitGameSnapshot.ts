import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

interface Snapshot {
  id: string;
  user_id: string;
  unit_id: string;
  test_type_id: string;
  games_config: GameConfig[];
  created_at: string;
}

/**
 * Hook to get or create a game snapshot for a specific unit.
 * This ensures games are locked in when the user first accesses a unit.
 */
export const useUnitGameSnapshot = (unitId: string | null, testTypeId: string | null) => {
  const { user } = useAuth();
  const [games, setGames] = useState<GameConfig[]>([]);
  const [groupedGames, setGroupedGames] = useState<GroupedGames>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  const fetchOrCreateSnapshot = useCallback(async () => {
    if (!unitId || !testTypeId || !user) {
      setGames([]);
      setGroupedGames({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call edge function to get or create snapshot
      const { data, error: fnError } = await supabase.functions.invoke('get-or-create-game-snapshot', {
        body: { unit_id: unitId, test_type_id: testTypeId }
      });

      if (fnError) throw fnError;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to get game snapshot');
      }

      const snapshot = data.snapshot as Snapshot;
      const gamesData = snapshot.games_config as GameConfig[];
      
      setGames(gamesData);
      setSnapshotId(snapshot.id);

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
      console.error("Error fetching/creating game snapshot:", err);
      setError("Failed to load games configuration");
    } finally {
      setLoading(false);
    }
  }, [unitId, testTypeId, user]);

  useEffect(() => {
    fetchOrCreateSnapshot();
  }, [fetchOrCreateSnapshot]);

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
    snapshotId,
    getGameByType,
    getGameById,
    getRequiredGames,
    getGamesBySection,
    getSortedSections,
    refetch: fetchOrCreateSnapshot,
  };
};
