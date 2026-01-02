import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  id: string;
  username: string | null;
  level: number;
  total_xp: number;
  study_streak: number;
}

export const useLeaderboard = (limit: number = 10) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .rpc("get_leaderboard", { limit_count: limit });

      if (error) {
        console.error("Error fetching leaderboard:", error);
      } else {
        setLeaderboard(data || []);
      }
      setLoading(false);
    };

    fetchLeaderboard();
  }, [limit]);

  return { leaderboard, loading };
};
