import { useState, useEffect } from "react";
import { StatsCard } from "./StatsCard";
import { StreakChart } from "./StreakChart";
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
  Target, 
  Clock, 
  Crown,
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
  totalXp: number;
  isUnlocked: boolean;
}

export const Dashboard = ({ onStartGame }: DashboardProps) => {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [gameProgress, setGameProgress] = useState<Record<string, { bestScore: number; completed: boolean; totalXp: number; totalTimeSeconds: number; attempts: number }>>({});
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
      totalXp: 0,
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

      // Calculate total XP from progress records
      const totalXp = unitProgress.reduce((sum, p) => sum + (p.total_xp || 0), 0);

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
        totalXp,
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

    // Fetch from user_progress table (game-level data)
    const { data, error } = await supabase
      .from('user_progress')
      .select('game_type, best_score, completed, total_xp, total_time_seconds, attempts')
      .eq('user_id', user.id)
      .eq('unit_id', unitId);

    if (error) {
      console.error('Error fetching game progress:', error);
      return;
    }

    const progress: Record<string, { bestScore: number; completed: boolean; totalXp: number; totalTimeSeconds: number; attempts: number }> = {};
    
    data?.forEach(record => {
      progress[record.game_type] = {
        bestScore: record.best_score || 0,
        completed: record.completed || false,
        totalXp: record.total_xp || 0,
        totalTimeSeconds: record.total_time_seconds || 0,
        attempts: record.attempts || 0,
      };
    });

    setGameProgress(progress);
  };

  const displayName = profile?.username || user?.email?.split('@')[0] || 'Player';

  const xpTooltip = `📊 XP Calculation (Per Game):

Each game's XP = (Avg Score × 0.5) + Time Bonus
Based on average across all attempts of that game.

Total XP = Sum of all games' XP

⏱️ Time Bonus Tiers (avg time per question):
• ≤5 seconds: +25 XP (fastest)
• 6-10 seconds: +20 XP
• 11-15 seconds: +15 XP
• 16-20 seconds: +10 XP
• 21-25 seconds: +5 XP
• 26-29 seconds: +1-4 XP
• ≥30 seconds: +0 XP

💡 Example: Avg 80% in avg 4s/q = 40 + 25 = 65 XP`;

  // Calculate XP progress to next level (100 XP per level)
  const currentXp = profile?.total_xp || 0;
  const currentLevel = profile?.level || 1;
  const xpForCurrentLevel = (currentLevel - 1) * 100;
  const xpInCurrentLevel = currentXp - xpForCurrentLevel;
  const xpNeededForNextLevel = 100;

  const stats = [
    { 
      title: `Level ${currentLevel}`, 
      value: `${currentXp.toLocaleString()} XP`, 
      icon: Crown, 
      variant: "primary" as const, 
      trend: "up" as const,
      tooltip: xpTooltip,
      progress: {
        current: xpInCurrentLevel,
        max: xpNeededForNextLevel,
        label: `${xpInCurrentLevel}/${xpNeededForNextLevel} XP to level ${currentLevel + 1}`
      }
    },
    { title: "Units Completed", value: `${userStats.unitsCompleted}/${units.length}`, icon: Target, variant: "secondary" as const },
  ];

  const currentUnit = selectedUnit || units[0];

  const getGameData = (gameType: string) => {
    const progress = gameProgress[gameType];
    return {
      progress: progress?.bestScore || 0,
      isCompleted: progress?.completed || false,
      totalXp: progress?.totalXp || 0,
      totalTimeSeconds: progress?.totalTimeSeconds || 0,
      attempts: progress?.attempts || 0,
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
      isLocked: false,
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <StatsCard key={stat.title} {...stat} />
          ))}
          <StreakChart />
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
                  if (!game.isLocked && onStartGame && currentUnit) {
                    onStartGame(game.gameType, currentUnit.id, currentUnit.title);
                  } else if (game.isLocked) {
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