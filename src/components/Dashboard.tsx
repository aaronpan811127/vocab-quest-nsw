import { useState, useEffect } from "react";
import { StatsCard } from "./StatsCard";
import { UnitCard } from "./UnitCard";
import { GameCard } from "./GameCard";
import { Leaderboard } from "./Leaderboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Trophy, 
  Target, 
  Clock, 
  Zap,
  Crown,
  Users,
  ArrowRight,
  BookOpen,
  Calendar
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DashboardProps {
  onStartGame?: (gameType: string, unitId: string, unitTitle: string) => void;
}

interface Unit {
  id: string;
  unitNumber: number;
  title: string;
  description: string;
  totalWords: number;
  completedGames: number;
  totalGames: number;
  averageScore: number;
  timeSpent: string;
  isUnlocked: boolean;
}

export const Dashboard = ({ onStartGame }: DashboardProps) => {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [gameProgress, setGameProgress] = useState<Record<string, { bestScore: number; completed: boolean }>>({});
  const [userStats, setUserStats] = useState({ avgScore: 0, unitsCompleted: 0 });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [studyHistory, setStudyHistory] = useState<Array<{
    id: string;
    game_type: string;
    score: number;
    created_at: string;
    unit_title: string;
  }>>([]);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedUnit) {
      fetchGameProgress(selectedUnit.id);
    }
  }, [user, selectedUnit]);

  const fetchUserStats = async () => {
    if (!user) return;

    // Fetch all game attempts for average score
    const { data: attempts, error: attemptsError } = await supabase
      .from('game_attempts')
      .select('score')
      .eq('user_id', user.id);

    if (attemptsError) {
      console.error('Error fetching attempts:', attemptsError);
      return;
    }

    // Calculate average score
    let avgScore = 0;
    if (attempts && attempts.length > 0) {
      const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
      avgScore = Math.round(totalScore / attempts.length);
    }

    // Fetch user progress to count completed units
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('reading_completed, listening_completed, speaking_completed, writing_completed')
      .eq('user_id', user.id);

    if (progressError) {
      console.error('Error fetching progress:', progressError);
      return;
    }

    // Count units where all 4 games are completed
    let unitsCompleted = 0;
    if (progress) {
      unitsCompleted = progress.filter(p => 
        p.reading_completed && p.listening_completed && 
        p.speaking_completed && p.writing_completed
      ).length;
    }

    setUserStats({ avgScore, unitsCompleted });
  };

  const fetchStudyHistory = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('game_attempts')
      .select('id, game_type, score, created_at, unit_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching study history:', error);
      return;
    }

    // Map unit IDs to titles
    const historyWithTitles = data.map(attempt => {
      const unit = units.find(u => u.id === attempt.unit_id);
      return {
        id: attempt.id,
        game_type: attempt.game_type,
        score: attempt.score,
        created_at: attempt.created_at,
        unit_title: unit?.title || 'Unknown Unit'
      };
    });

    setStudyHistory(historyWithTitles);
  };

  const handleShowHistory = () => {
    fetchStudyHistory();
    setShowHistory(true);
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('unit_number');

    if (error) {
      console.error('Error fetching units:', error);
      return;
    }

    const formattedUnits: Unit[] = data.map((unit, index) => ({
      id: unit.id,
      unitNumber: unit.unit_number,
      title: unit.title,
      description: unit.description || "Master vocabulary through interactive games",
      totalWords: Array.isArray(unit.words) ? unit.words.length : 10,
      completedGames: 0,
      totalGames: 4,
      averageScore: 0,
      timeSpent: "0m",
      isUnlocked: index < 3, // First 3 units unlocked
    }));

    setUnits(formattedUnits);
    if (formattedUnits.length > 0 && !selectedUnit) {
      setSelectedUnit(formattedUnits[0]);
    }
  };

  const fetchGameProgress = async (unitId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('game_attempts')
      .select('game_type, score, completed')
      .eq('user_id', user.id)
      .eq('unit_id', unitId);

    if (error) {
      console.error('Error fetching game progress:', error);
      return;
    }

    const progress: Record<string, { bestScore: number; completed: boolean }> = {};
    
    data?.forEach(attempt => {
      const existing = progress[attempt.game_type];
      if (!existing || attempt.score > existing.bestScore) {
        progress[attempt.game_type] = {
          bestScore: attempt.score,
          completed: attempt.score === 100 || existing?.completed || false
        };
      }
    });

    setGameProgress(progress);
  };

  const displayName = profile?.username || user?.email?.split('@')[0] || 'Player';

  const stats = [
    { title: "Total XP", value: profile?.total_xp?.toLocaleString() || "0", icon: Zap, variant: "primary" as const, trend: "up" as const },
    { title: "Units Completed", value: `${userStats.unitsCompleted}/${units.length}`, icon: Target, variant: "secondary" as const },
    { title: "Study Streak", value: `${profile?.study_streak || 0} days`, icon: Trophy, variant: "success" as const, trend: "up" as const },
    { title: "Avg Score", value: `${userStats.avgScore}%`, icon: Crown, variant: "warning" as const },
  ];

  const currentUnit = selectedUnit || units[0];

  const getGameData = (gameType: string) => {
    const progress = gameProgress[gameType];
    return {
      progress: progress?.bestScore || 0,
      isCompleted: progress?.completed || false,
    };
  };

  const games = [
    {
      title: "Reading Quest",
      description: "Embark on reading adventures with comprehension challenges",
      gameType: "reading" as const,
      ...getGameData("reading"),
      isLocked: false,
      difficulty: "Medium" as const,
    },
    {
      title: "Audio Challenge",
      description: "Listen and spell words perfectly to advance",
      gameType: "listening" as const,
      ...getGameData("listening"),
      isLocked: true,
      difficulty: "Easy" as const,
    },
    {
      title: "Voice Master",
      description: "Speak clearly and accurately to unlock achievements",
      gameType: "speaking" as const,
      ...getGameData("speaking"),
      isLocked: true,
      difficulty: "Hard" as const,
    },
    {
      title: "Story Creator",
      description: "Craft creative sentences using your new vocabulary",
      gameType: "writing" as const,
      ...getGameData("writing"),
      isLocked: true,
      difficulty: "Medium" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {displayName}! 🎮</h1>
            <p className="text-muted-foreground mt-1">Ready to level up your vocabulary skills?</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-gradient-success text-success-foreground">
              <Crown className="h-4 w-4 mr-2" />
              Level {profile?.level || 1}
            </Badge>
            <Button variant="gaming" onClick={() => setShowLeaderboard(true)}>
              <Users className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <StatsCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Current Unit Progress */}
        {currentUnit && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Current Unit: {currentUnit.title}</h2>
            <Button variant="outline" onClick={handleShowHistory}>
              <Clock className="h-4 w-4 mr-2" />
              Study History
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {games.map((game, index) => (
              <GameCard 
                key={game.title} 
                {...game} 
                onPlay={() => {
                  if (game.gameType === "reading" && onStartGame && currentUnit) {
                    onStartGame("reading", currentUnit.id, currentUnit.title);
                  } else {
                    console.log(`${game.title} coming soon!`);
                  }
                }}
              />
            ))}
          </div>
        </div>
        )}

        {/* Units Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">All Units</h2>
            <Button variant="ghost">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {units.map((unit, index) => (
              <UnitCard 
                key={unit.unitNumber} 
                {...unit} 
                onEnter={() => console.log(`Entering Unit ${unit.unitNumber}`)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard Overlay */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50">
          <Leaderboard onBack={() => setShowLeaderboard(false)} />
        </div>
      )}

      {/* Study History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Study History
            </DialogTitle>
          </DialogHeader>
          
          {studyHistory.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No study sessions yet</p>
              <p className="text-sm text-muted-foreground">Complete a game to see your history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {studyHistory.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{entry.game_type} Quest</p>
                      <p className="text-sm text-muted-foreground">{entry.unit_title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{entry.score}%</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};