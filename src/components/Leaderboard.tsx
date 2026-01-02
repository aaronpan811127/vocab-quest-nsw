import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Award, Zap, ArrowLeft } from "lucide-react";

interface LeaderboardProps {
  onBack?: () => void;
}

export const Leaderboard = ({ onBack }: LeaderboardProps) => {
  const { leaderboard, loading } = useLeaderboard(20);
  const { user } = useAuth();

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-bold">#{index + 1}</span>;
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

  return (
    <div className="min-h-screen bg-gradient-hero py-8">
      <div className="max-w-3xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="h-8 w-8 text-warning" />
              Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">Top vocabulary masters</p>
          </div>
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-card/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No players yet!</h3>
            <p className="text-muted-foreground">Be the first to join the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-4 p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${getRankBg(index)}`}
              >
                {/* Rank */}
                <div className="w-10 flex justify-center">
                  {getRankIcon(index)}
                </div>

                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {entry.username?.[0]?.toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {entry.username || "Anonymous Player"}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Level {entry.level}
                    </span>
                    <span className="flex items-center gap-1">
                      🔥 {entry.study_streak} streak
                    </span>
                  </div>
                </div>

                {/* XP */}
                <Badge className="bg-gradient-primary text-primary-foreground px-3 py-1">
                  <Zap className="h-3 w-3 mr-1" />
                  {entry.total_xp.toLocaleString()} XP
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
