import { useState, useEffect } from "react";
import { StatsCard } from "./StatsCard";
import { StreakChart } from "./StreakChart";
import { UnitCard } from "./UnitCard";
import { GameCard } from "./GameCard";
import { LeaderboardDialog } from "./LeaderboardDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Crown,
  ArrowRight,
  Layers,
  ArrowLeft,
  Link2,
  CircleOff,
  Lightbulb,
  BookOpen,
  Trophy,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DashboardProps {
  onStartGame?: (gameType: string, unitId: string, unitTitle: string, playAllWordsOnStart?: boolean) => void;
  onBack?: () => void;
  selectedUnitId?: string | null;
  onUnitChange?: (unitId: string | null) => void;
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
  isPremiumLocked?: boolean;
}

export const Dashboard = ({ onStartGame, onBack, selectedUnitId, onUnitChange }: DashboardProps) => {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const { selectedTestType } = useTestType();
  const { maxUnitsPerTestType, tier } = useSubscription();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [gameProgress, setGameProgress] = useState<
    Record<
      string,
      { bestScore: number; completed: boolean; totalXp: number; totalTimeSeconds: number; attempts: number }
    >
  >({});
  const [userStats, setUserStats] = useState({ avgScore: 0, unitsCompleted: 0 });
  const [testTypeStats, setTestTypeStats] = useState({ level: 1, totalXp: 0, studyStreak: 0 });
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [gameHistory, setGameHistory] = useState<
    Record<string, Array<{ id: string; score: number; created_at: string }>>
  >({});

  useEffect(() => {
    if (user && selectedTestType) {
      fetchUnitsWithProgress();
      fetchUserStats();
      fetchTestTypeStats();
    } else if (selectedTestType) {
      fetchUnits();
    }
  }, [user, selectedTestType]);

  const fetchTestTypeStats = async () => {
    if (!user || !selectedTestType) return;

    const { data, error } = await supabase
      .from("leaderboard")
      .select("level, total_xp, study_streak")
      .eq("user_id", user.id)
      .eq("test_type_id", selectedTestType.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching test type stats:", error);
      return;
    }

    if (data) {
      setTestTypeStats({
        level: data.level || 1,
        totalXp: data.total_xp || 0,
        studyStreak: data.study_streak || 0,
      });
    } else {
      setTestTypeStats({ level: 1, totalXp: 0, studyStreak: 0 });
    }
  };

  useEffect(() => {
    if (user && selectedUnit) {
      fetchGameProgress(selectedUnit.id);
      fetchGameHistory(selectedUnit.id);
    }
  }, [user, selectedUnit]);

  const fetchUserStats = async () => {
    if (!user) return;

    const { data: attempts, error: attemptsError } = await supabase
      .from("game_attempts")
      .select("score")
      .eq("user_id", user.id);

    if (attemptsError) {
      console.error("Error fetching attempts:", attemptsError);
      return;
    }

    let avgScore = 0;
    if (attempts && attempts.length > 0) {
      const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
      avgScore = Math.round(totalScore / attempts.length);
    }

    // Get all unit IDs for the current test type
    const currentTestTypeUnitIds = new Set<string>();
    if (selectedTestType) {
      const { data: testTypeUnits } = await supabase
        .from("units")
        .select("id")
        .eq("test_type_id", selectedTestType.id);
      
      testTypeUnits?.forEach((u) => currentTestTypeUnitIds.add(u.id));
    }

    const { data: progress, error: progressError } = await supabase
      .from("user_progress")
      .select("unit_id, completed")
      .eq("user_id", user.id);

    if (progressError) {
      console.error("Error fetching progress:", progressError);
      return;
    }

    const unitCompletionMap = new Map<string, number>();
    progress?.forEach((p) => {
      // Only count progress for units in the current test type
      if (p.completed && currentTestTypeUnitIds.has(p.unit_id)) {
        unitCompletionMap.set(p.unit_id, (unitCompletionMap.get(p.unit_id) || 0) + 1);
      }
    });

    let unitsCompleted = 0;
    unitCompletionMap.forEach((count) => {
      if (count >= 4) unitsCompleted++;
    });

    setUserStats({ avgScore, unitsCompleted });
  };

  const fetchGameHistory = async (unitId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("game_attempts")
      .select("id, game_type, score, created_at")
      .eq("user_id", user.id)
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching game history:", error);
      return;
    }

    const historyByGame: Record<string, Array<{ id: string; score: number; created_at: string }>> = {};
    data?.forEach((attempt) => {
      if (!historyByGame[attempt.game_type]) {
        historyByGame[attempt.game_type] = [];
      }
      historyByGame[attempt.game_type].push({
        id: attempt.id,
        score: attempt.score,
        created_at: attempt.created_at,
      });
    });

    setGameHistory(historyByGame);
  };

  const fetchUnits = async () => {
    if (!selectedTestType) return;

    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("test_type_id", selectedTestType.id)
      .order("unit_number");

    if (error) {
      console.error("Error fetching units:", error);
      return;
    }

    const formattedUnits: Unit[] = data.map((unit, index) => ({
      id: unit.id,
      unitNumber: unit.unit_number,
      title: unit.title,
      description: unit.description || "Master vocabulary through interactive games",
      totalWords: Array.isArray(unit.words) ? unit.words.length : 10,
      completedGames: 0,
      totalGames: 8,
      totalXp: 0,
      isUnlocked: index === 0 && index < maxUnitsPerTestType,
    }));

    setUnits(formattedUnits);
    if (formattedUnits.length > 0) {
      // Use the persisted selectedUnitId from parent, or default to first unit
      const unitToSelect = selectedUnitId
        ? formattedUnits.find((u) => u.id === selectedUnitId) || formattedUnits[0]
        : formattedUnits[0];
      setSelectedUnit(unitToSelect);
    }
  };

  const fetchUnitsWithProgress = async () => {
    if (!user || !selectedTestType) return;

    const { data: unitsData, error: unitsError } = await supabase
      .from("units")
      .select("*")
      .eq("test_type_id", selectedTestType.id)
      .order("unit_number");

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      return;
    }

    const { data: progressData, error: progressError } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id);

    if (progressError) {
      console.error("Error fetching progress:", progressError);
    }

    const unitProgressMap = new Map<string, typeof progressData>();
    progressData?.forEach((p) => {
      const existing = unitProgressMap.get(p.unit_id) || [];
      existing.push(p);
      unitProgressMap.set(p.unit_id, existing);
    });

    const formattedUnits: Unit[] = unitsData.map((unit, index) => {
      const unitProgress = unitProgressMap.get(unit.id) || [];
      const completedGames = unitProgress.filter((p) => p.completed).length;
      const totalXp = unitProgress.reduce((sum, p) => sum + (p.total_xp || 0), 0);

      // Check subscription limit first
      const isWithinSubscriptionLimit = index < maxUnitsPerTestType;
      
      let isUnlocked = index === 0 && isWithinSubscriptionLimit;
      if (index > 0 && isWithinSubscriptionLimit) {
        const prevUnitId = unitsData[index - 1].id;
        const prevProgress = unitProgressMap.get(prevUnitId) || [];
        const prevCompletedGames = prevProgress.filter((p) => p.completed).length;
        isUnlocked = prevCompletedGames >= 4;
      }

      return {
        id: unit.id,
        unitNumber: unit.unit_number,
        title: unit.title,
        description: unit.description || "Master vocabulary through interactive games",
        totalWords: Array.isArray(unit.words) ? unit.words.length : 10,
        completedGames,
        totalGames: 8,
        totalXp,
        isUnlocked,
        isPremiumLocked: !isWithinSubscriptionLimit,
      };
    });

    setUnits(formattedUnits);
    if (formattedUnits.length > 0) {
      // Use the persisted selectedUnitId from parent, or default to first unit
      const unitToSelect = selectedUnitId
        ? formattedUnits.find((u) => u.id === selectedUnitId) || formattedUnits[0]
        : formattedUnits[0];
      setSelectedUnit(unitToSelect);
    }
  };

  const fetchGameProgress = async (unitId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("user_progress")
      .select("game_type, best_score, completed, total_xp, total_time_seconds, attempts")
      .eq("user_id", user.id)
      .eq("unit_id", unitId);

    if (error) {
      console.error("Error fetching game progress:", error);
      return;
    }

    const progress: Record<
      string,
      { bestScore: number; completed: boolean; totalXp: number; totalTimeSeconds: number; attempts: number }
    > = {};

    data?.forEach((record) => {
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

  const displayName = profile?.username || user?.email?.split("@")[0] || "Player";

  const xpTooltip = `Gain XP by completing challenges with accuracy AND speed.

📊 XP Calculation:
Total XP = Sum of all Games' XP

Game XP = (Avg Score over all attempts × 0.5) + Time Bonus

⏱️ Time Bonus Tiers (avg time per question):
• ≤5 seconds: +25 XP (fastest)
• 6-10 seconds: +20 XP
• 11-15 seconds: +15 XP
• 16-20 seconds: +10 XP
• 21-25 seconds: +5 XP
• 26-29 seconds: +1-4 XP
• ≥30 seconds: +0 XP

💡 Example: 
• 3 attempts with scores 20%,30%,100% -> Avg Score of 50% i.e.(20%+30%+100%)/3
• Avg time per question over all 3 attemps is 8 secs
• Game XP = (50 × 0.5) + 20 = 45
`;

  const currentXp = testTypeStats.totalXp;
  const currentLevel = testTypeStats.level;
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
        label: `${xpInCurrentLevel}/${xpNeededForNextLevel} XP to level ${currentLevel + 1}`,
      },
    },
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

  // Learn section games - practice games, no XP accumulation
  const learnGames = [
    {
      title: "Flashcards",
      description: "Review words with interactive flashcards",
      gameType: "flashcards" as const,
      ...getGameData("flashcards"),
      isLocked: false,
      icon: Layers,
    },
    {
      title: "Matching",
      description: "Match words with their definitions",
      gameType: "matching" as const,
      ...getGameData("matching"),
      isLocked: false,
      icon: Link2,
    },
    {
      title: "Odd One Out",
      description: "Find the word that doesn't belong",
      gameType: "oddoneout" as const,
      ...getGameData("oddoneout"),
      isLocked: false,
      icon: CircleOff,
    },
    {
      title: "Word Intuition",
      description: "Test your word sense with context clues",
      gameType: "intuition" as const,
      ...getGameData("intuition"),
      isLocked: false,
      icon: Lightbulb,
    },
  ];

  // Check if all Learn games are completed
  const allLearnGamesCompleted = learnGames.every((game) => game.isCompleted);

  // Challenge section games - XP earning games (locked until all Learn games completed)
  const challengeGames = [
    {
      title: "Reading Quest",
      description: "Embark on reading adventures with comprehension challenges",
      gameType: "reading" as const,
      ...getGameData("reading"),
      isLocked: !allLearnGamesCompleted,
    },
    {
      title: "Audio Challenge",
      description: "Listen and spell words perfectly to advance",
      gameType: "listening" as const,
      ...getGameData("listening"),
      isLocked: !allLearnGamesCompleted,
    },
    {
      title: "Voice Master",
      description: "Speak clearly and accurately to unlock achievements",
      gameType: "speaking" as const,
      ...getGameData("speaking"),
      isLocked: !allLearnGamesCompleted,
    },
    {
      title: "Story Creator",
      description: "Craft creative sentences using your new vocabulary",
      gameType: "writing" as const,
      ...getGameData("writing"),
      isLocked: !allLearnGamesCompleted,
    },
  ];

  if (!selectedTestType) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No Test Type Selected</h2>
          <p className="text-muted-foreground">Please select a test type from the home page.</p>
          {onBack && (
            <Button onClick={onBack} variant="gaming">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {selectedTestType.name}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-3xl font-bold">Welcome back, {displayName}! 🎮</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Ready to level up your vocabulary skills?</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatsCard {...stats[0]} action={<LeaderboardDialog />} />
          <StreakChart />
        </div>

        {/* Current Unit Progress */}
        {currentUnit && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-2xl font-bold">Current Unit: {currentUnit.unitNumber}</h2>
            </div>

            {/* Learn Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <BookOpen className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Learn</h3>
                </div>
                <span className="text-sm text-muted-foreground">Practice and master vocabulary</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {learnGames.map((game) => (
                  <Button
                    key={game.title}
                    variant="outline"
                    className={`h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50 transition-all relative ${game.isCompleted ? 'border-green-500/50 bg-green-500/5' : ''}`}
                    onClick={() => onStartGame && onStartGame(game.gameType, currentUnit.id, `Unit ${currentUnit.unitNumber}`)}
                  >
                    {game.isCompleted && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 absolute top-2 right-2" />
                    )}
                    <game.icon className="h-6 w-6 text-primary" />
                    <span className="font-medium">{game.title}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Challenge Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 ${allLearnGamesCompleted ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {allLearnGamesCompleted ? (
                    <Trophy className="h-5 w-5" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                  <h3 className="text-lg font-semibold">Challenge</h3>
                </div>
                {allLearnGamesCompleted ? (
                  <span className="text-sm text-muted-foreground">Earn XP and level up</span>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Complete all Learn games to unlock
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                {challengeGames.map((game) => (
                  <GameCard
                    key={game.title}
                    {...game}
                    history={gameHistory[game.gameType] || []}
                    onPlay={() => {
                      if (!game.isLocked && onStartGame && currentUnit) {
                        const playAllWordsOnStart =
                          game.isCompleted &&
                          (game.gameType === "listening" ||
                            game.gameType === "speaking" ||
                            game.gameType === "writing");

                        onStartGame(game.gameType, currentUnit.id, `Unit ${currentUnit.unitNumber}`, playAllWordsOnStart);
                      } else if (game.isLocked) {
                        console.log(`${game.title} coming soon!`);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Units Grid */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-bold">All Units</h2>
              <Badge variant="secondary" className="gap-1">
                <Target className="h-3 w-3" />
                {userStats.unitsCompleted}/{units.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAllUnits(!showAllUnits)}>
              {showAllUnits ? "Less" : "View All"}
              <ArrowRight className={`h-4 w-4 ml-1 sm:ml-2 transition-transform ${showAllUnits ? "rotate-90" : ""}`} />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {(showAllUnits ? units : units.slice(0, 3)).map((unit) => (
              <UnitCard
                key={unit.unitNumber}
                {...unit}
                isSelected={selectedUnit?.id === unit.id}
                onEnter={() => {
                  if (unit.isUnlocked) {
                    setSelectedUnit(unit);
                    onUnitChange?.(unit.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    toast({
                      title: `Unit ${unit.unitNumber} Selected`,
                      description: `Now studying: Unit ${unit.unitNumber}`,
                    });
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
