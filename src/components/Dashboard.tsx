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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [gameProgress, setGameProgress] = useState<Record<string, { bestScore: number; completed: boolean }>>({});
  const [userStats, setUserStats] = useState({ avgScore: 0, unitsCompleted: 0 });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [studyHistory, setStudyHistory] = useState<Array<{
    id: string;
    game_type: string;
    score: number;
    created_at: string;
    unit_title: string;
  }>>([]);

  useEffect(() => {
    if (user) {
      fetchUnitsWithProgress();
      fetchUserStats();
    } else {
      fetchUnits();
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

    // Fetch user progress to count completed units (now at game level)
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('unit_id, completed')
      .eq('user_id', user.id);

    if (progressError) {
      console.error('Error fetching progress:', progressError);
      return;
    }

    // Group by unit and count units where all 4 games are completed
    const unitCompletionMap = new Map<string, number>();
    progress?.forEach(p => {
      if (p.completed) {
        unitCompletionMap.set(p.unit_id, (unitCompletionMap.get(p.unit_id) || 0) + 1);
      }
    });
    
    // Count units with 4 completed games
    let unitsCompleted = 0;
    unitCompletionMap.forEach(count => {
      if (count >= 4) unitsCompleted++;
    });

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
      isUnlocked: index === 0, // Only first unit unlocked for guests
    }));

    setUnits(formattedUnits);
    if (formattedUnits.length > 0 && !selectedUnit) {
      setSelectedUnit(formattedUnits[0]);
    }
  };

  const fetchUnitsWithProgress = async () => {
    if (!user) return;

    // Fetch units
    const { data: unitsData, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .order('unit_number');

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
      return;
    }

    // Fetch user progress for all units (now at game level)
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id);

    if (progressError) {
      console.error('Error fetching progress:', progressError);
    }

    // Group progress by unit_id
    const unitProgressMap = new Map<string, typeof progressData>();
    progressData?.forEach(p => {
      const existing = unitProgressMap.get(p.unit_id) || [];
      existing.push(p);
      unitProgressMap.set(p.unit_id, existing);
    });

    const formattedUnits: Unit[] = unitsData.map((unit, index) => {
      const unitProgress = unitProgressMap.get(unit.id) || [];
      
      // Count completed games from progress records
      const completedGames = unitProgress.filter(p => p.completed).length;

      // Calculate average score and total time from progress records
      let averageScore = 0;
      let totalTimeSeconds = 0;
      if (unitProgress.length > 0) {
        const totalScore = unitProgress.reduce((sum, p) => sum + (p.best_score || 0), 0);
        averageScore = Math.round(totalScore / unitProgress.length);
        totalTimeSeconds = unitProgress.reduce((sum, p) => sum + (p.total_time_seconds || 0), 0);
      }

      // Format time spent
      const totalMinutes = Math.round(totalTimeSeconds / 60);
      const timeSpent = totalMinutes > 60 
        ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
        : `${totalMinutes}m`;

      // Check if previous unit is completed (all 4 games done)
      let isUnlocked = index === 0; // First unit always unlocked
      if (index > 0) {
        const prevUnitId = unitsData[index - 1].id;
        const prevProgress = unitProgressMap.get(prevUnitId) || [];
        const prevCompletedGames = prevProgress.filter(p => p.completed).length;
        isUnlocked = prevCompletedGames >= 4;
      }

      return {
        id: unit.id,
        unitNumber: unit.unit_number,
        title: unit.title,
        description: unit.description || "Master vocabulary through interactive games",
        totalWords: Array.isArray(unit.words) ? unit.words.length : 10,
        completedGames,
        totalGames: 4,
        averageScore,
        timeSpent,
        isUnlocked,
      };
    });

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

  const xpTooltip = `📊 XP Calculation (Per Game):

Each game earns: (Score × 0.5) + Time Bonus
Your Total XP = Sum of all games

⏱️ Time Bonus Tiers (per question):
• ≤5 seconds: +25 XP (fastest)
• 6-10 seconds: +20 XP
• 11-15 seconds: +15 XP
• 16-20 seconds: +10 XP
• 21-25 seconds: +5 XP
• 26-29 seconds: +1-4 XP
• ≥30 seconds: +0 XP

💡 Example: 80% score in 4s/question = 40 + 25 = 65 XP`;

  const stats = [
    { 
      title: "Total XP", 
      value: profile?.total_xp?.toLocaleString() || "0", 
      icon: Zap, 
      variant: "primary" as const, 
      trend: "up" as const,
      tooltip: xpTooltip
    },
    { title: "Units Completed", value: `${userStats.unitsCompleted}/${units.length}`, icon: Target, variant: "secondary" as const },
    { title: "Study Streak", value: `${profile?.study_streak || 0} days`, icon: Trophy, variant: "success" as const, trend: "up" as const },
    { title: "Level", value: `${profile?.level || 1}`, icon: Crown, variant: "warning" as const },
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
    },
    {
      title: "Audio Challenge",
      description: "Listen and spell words perfectly to advance",
      gameType: "listening" as const,
      ...getGameData("listening"),
      isLocked: true,
    },
    {
      title: "Voice Master",
      description: "Speak clearly and accurately to unlock achievements",
      gameType: "speaking" as const,
      ...getGameData("speaking"),
      isLocked: true,
    },
    {
      title: "Story Creator",
      description: "Craft creative sentences using your new vocabulary",
      gameType: "writing" as const,
      ...getGameData("writing"),
      isLocked: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {displayName}! 🎮</h1>
          <p className="text-muted-foreground mt-1">Ready to level up your vocabulary skills?</p>
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
            <Button variant="ghost" onClick={() => setShowAllUnits(!showAllUnits)}>
              {showAllUnits ? 'Show Less' : 'View All'}
              <ArrowRight className={`h-4 w-4 ml-2 transition-transform ${showAllUnits ? 'rotate-90' : ''}`} />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {(showAllUnits ? units : units.slice(0, 3)).map((unit) => (
              <UnitCard 
                key={unit.unitNumber} 
                {...unit} 
                isSelected={selectedUnit?.id === unit.id}
                onEnter={() => {
                  if (unit.isUnlocked) {
                    setSelectedUnit(unit);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    toast({
                      title: `Unit ${unit.unitNumber} Selected`,
                      description: `Now studying: ${unit.title}`,
                    });
                  }
                }}
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