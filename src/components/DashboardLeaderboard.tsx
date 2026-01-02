import { useState, useEffect } from "react";
import { useTestType } from "@/contexts/TestTypeContext";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Medal, Award, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  id: string;
  username: string | null;
  level: number;
  total_xp: number;
  study_streak: number;
}

export const DashboardLeaderboard = () => {
  const { selectedTestType } = useTestType();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedTestType?.id) {
      fetchLeaderboard();
    }
  }, [selectedTestType?.id]);

  const fetchLeaderboard = async () => {
    if (!selectedTestType?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .rpc("get_leaderboard", { 
        limit_count: 5,
        p_test_type_id: selectedTestType.id
      });

    if (error) {
      console.error("Error fetching leaderboard:", error);
    } else {
      setLeaderboard(data || []);
    }
    setLoading(false);
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 1:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />;
      default:
        return <span className="text-xs text-muted-foreground font-bold">#{index + 1}</span>;
    }
  };

  const getRankBg = (index: number) => {
    switch (index) {
      case 0:
        return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/30";
      case 1:
        return "bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30";
      case 2:
        return "bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/30";
      default:
        return "bg-card/50 border-border/50";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h2 className="text-lg sm:text-xl font-bold">Leaderboard</h2>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-card/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-warning" />
        <h2 className="text-lg sm:text-xl font-bold">Leaderboard</h2>
        <Badge variant="outline" className="text-xs">
          {selectedTestType?.name}
        </Badge>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-8 bg-card/30 rounded-xl">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No players yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-lg border backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] ${getRankBg(index)}`}
            >
              {/* Rank */}
              <div className="w-6 flex justify-center">
                {getRankIcon(index)}
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                {entry.username?.[0]?.toUpperCase() || "?"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {entry.username || "Anonymous"}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Lv.{entry.level}</span>
                  <span>🔥{entry.study_streak}</span>
                </div>
              </div>

              {/* XP */}
              <Badge className="bg-gradient-primary text-primary-foreground text-xs px-2 py-0.5">
                <Zap className="h-3 w-3 mr-1" />
                {entry.total_xp.toLocaleString()}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
