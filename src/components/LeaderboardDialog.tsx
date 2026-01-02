import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Medal, Award, Zap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  id: string;
  username: string | null;
  level: number;
  total_xp: number;
  study_streak: number;
  rank?: number;
}

export const LeaderboardDialog = () => {
  const { user } = useAuth();
  const { selectedTestType } = useTestType();
  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [userContext, setUserContext] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && selectedTestType?.id) {
      fetchLeaderboard();
    }
  }, [open, selectedTestType?.id]);

  const fetchLeaderboard = async () => {
    if (!selectedTestType?.id) return;
    
    setLoading(true);
    
    // Fetch top 10
    const { data: top10, error: top10Error } = await supabase
      .rpc("get_leaderboard", { 
        limit_count: 10,
        p_test_type_id: selectedTestType.id
      });

    if (top10Error) {
      console.error("Error fetching top 10:", top10Error);
    } else {
      setTopPlayers((top10 || []).map((p, i) => ({ ...p, rank: i + 1 })));
    }

    // If user is logged in, find their position and surrounding players
    if (user) {
      // Get full leaderboard to find user position
      const { data: fullBoard, error: fullError } = await supabase
        .rpc("get_leaderboard", { 
          limit_count: 100,
          p_test_type_id: selectedTestType.id
        });

      if (!fullError && fullBoard) {
        const userIndex = fullBoard.findIndex((p: LeaderboardEntry) => p.id === user.id);
        
        if (userIndex !== -1) {
          setUserRank(userIndex + 1);
          
          // Only show context if user is not in top 10
          if (userIndex >= 10) {
            const startIdx = Math.max(0, userIndex - 3);
            const endIdx = Math.min(fullBoard.length, userIndex + 4);
            const context = fullBoard.slice(startIdx, endIdx).map((p: LeaderboardEntry, i: number) => ({
              ...p,
              rank: startIdx + i + 1
            }));
            setUserContext(context);
          } else {
            setUserContext([]);
          }
        } else {
          setUserRank(null);
          setUserContext([]);
        }
      }
    }

    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 2:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 3:
        return <Award className="h-4 w-4 text-amber-600" />;
      default:
        return <span className="text-xs text-muted-foreground font-bold w-4 text-center">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "bg-primary/20 border-primary/50 ring-1 ring-primary/30";
    }
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/30";
      case 2:
        return "bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30";
      case 3:
        return "bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/30";
      default:
        return "bg-card/50 border-border/50";
    }
  };

  const renderPlayer = (entry: LeaderboardEntry) => {
    const isCurrentUser = user?.id === entry.id;
    
    return (
      <div
        key={`${entry.id}-${entry.rank}`}
        className={`flex items-center gap-3 p-2.5 rounded-lg border backdrop-blur-sm transition-all ${getRankBg(entry.rank || 0, isCurrentUser)}`}
      >
        <div className="w-6 flex justify-center">
          {getRankIcon(entry.rank || 0)}
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          {entry.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate flex items-center gap-2">
            {entry.username || "Anonymous"}
            {isCurrentUser && <Badge variant="outline" className="text-[10px] py-0 px-1">You</Badge>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Lv.{entry.level}</span>
            <span>🔥{entry.study_streak}</span>
          </div>
        </div>
        <Badge className="bg-gradient-primary text-primary-foreground text-xs px-2 py-0.5">
          <Zap className="h-3 w-3 mr-1" />
          {entry.total_xp.toLocaleString()}
        </Badge>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Trophy className="h-4 w-4 text-warning" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Leaderboard
            <Badge variant="outline" className="text-xs ml-2">
              {selectedTestType?.name}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-card/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : topPlayers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No players yet. Be the first!</p>
            </div>
          ) : (
            <>
              {/* Top 10 */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top 10</h3>
                {topPlayers.map(renderPlayer)}
              </div>
              
              {/* User context if not in top 10 */}
              {userContext.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Your Position #{userRank}
                  </h3>
                  {userContext.map(renderPlayer)}
                </div>
              )}
              
              {/* If user has no rank yet */}
              {user && userRank === null && (
                <div className="text-center py-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">Play games to appear on the leaderboard!</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
