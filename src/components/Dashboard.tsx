import { useState, useEffect } from "react";
import { StatsCard } from "./StatsCard";
import { StreakChart } from "./StreakChart";
import { UnitCard } from "./UnitCard";
import { GameCard } from "./GameCard";
import { LeaderboardDialog } from "./LeaderboardDialog";
import { WordStruggleAnalytics } from "./WordStruggleAnalytics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Target,
  Crown,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Trophy,
  CheckCircle2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useGamesConfig, GameConfig } from "@/hooks/useGamesConfig";
import { getGameIcon } from "@/utils/gameIcons";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DashboardProps {
  onStartGame?: (gameType: string, unitId: string, unitTitle: string, playAllWordsOnStart?: boolean, gameId?: string) => void;
  onBack?: () => void;
  selectedUnitId?: string | null;
  onUnitChange?: (unitId: string | null) => void;
}

interface SectionStats {
  sectionName: string;
  completedGames: number;
  totalGames: number;
}

interface Unit {
  id: string;
  unitNumber: number;
  title: string;
  description: string;
  totalWords: number;
  sectionStats: SectionStats[];
  totalXp: number;
  isUnlocked: boolean;
  isPremiumLocked?: boolean;
}

interface GameProgress {
  gameId: string;
  bestScore: number;
  completed: boolean;
  totalXp: number;
  totalTimeSeconds: number;
  attempts: number;
}

export const Dashboard = ({ onStartGame, onBack, selectedUnitId, onUnitChange }: DashboardProps) => {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const { selectedTestType } = useTestType();
  const { maxUnitsPerTestType, tier } = useSubscription();
  const { games: gamesConfig, groupedGames, loading: gamesLoading, getSortedSections, getRequiredGames } = useGamesConfig(selectedTestType?.id || null);
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [gameProgress, setGameProgress] = useState<Record<string, GameProgress>>({});
  const [userStats, setUserStats] = useState({ avgScore: 0, unitsCompleted: 0 });
  const [testTypeStats, setTestTypeStats] = useState({ level: 1, totalXp: 0, studyStreak: 0 });
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [gameHistory, setGameHistory] = useState<
    Record<string, Array<{ id: string; score: number; created_at: string }>>
  >({});
  const [activeSessionTimes, setActiveSessionTimes] = useState<Record<string, number>>({});
  const [testConfirmDialog, setTestConfirmDialog] = useState<{
    open: boolean;
    gameType: string;
    gameId: string;
    gameName: string;
  } | null>(null);

  useEffect(() => {
    if (user && selectedTestType) {
      fetchUnitsWithProgress();
      fetchUserStats();
      fetchTestTypeStats();
    } else if (selectedTestType) {
      fetchUnits();
    }
  }, [user, selectedTestType, gamesConfig]);

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
  }, [user, selectedUnit, gamesConfig]);

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

    const requiredGames = getRequiredGames();
    const requiredGameIds = new Set(requiredGames.map((g) => g.game_id));

    // Map game_id -> max_attempts (used to treat single-attempt tests as completed once attempted)
    const gameMaxAttemptsMap = new Map<string, number | null>();
    gamesConfig.forEach((g) => {
      const raw = (g.rules as any)?.max_attempts;
      const parsed =
        typeof raw === "number"
          ? raw
          : typeof raw === "string" && raw.trim() !== ""
            ? Number(raw)
            : null;
      gameMaxAttemptsMap.set(g.game_id, Number.isFinite(parsed as number) ? (parsed as number) : null);
    });

    const { data: progress, error: progressError } = await supabase
      .from("user_progress")
      .select("unit_id, game_id, completed, attempts, best_score")
      .eq("user_id", user.id);

    if (progressError) {
      console.error("Error fetching progress:", progressError);
      return;
    }

    type ProgressRow = {
      unit_id: string;
      game_id: string;
      completed: boolean;
      attempts: number;
      best_score: number;
    };

    const progressRows = (progress ?? []) as ProgressRow[];

    const isEffectivelyCompleted = (p: ProgressRow) => {
      const maxAttempts = gameMaxAttemptsMap.get(p.game_id);
      if (maxAttempts === 1 && ((p.attempts || 0) > 0 || (p.best_score || 0) > 0)) return true;
      return !!p.completed;
    };

    // A unit is complete when all required games are completed
    let unitsCompleted = 0;

    if (requiredGames.length > 0) {
      const progressByUnit = new Map<string, ProgressRow[]>();

      progressRows.forEach((p) => {
        if (!currentTestTypeUnitIds.has(p.unit_id)) return;
        if (!requiredGameIds.has(p.game_id)) return;
        const existing = progressByUnit.get(p.unit_id) ?? [];
        existing.push(p);
        progressByUnit.set(p.unit_id, existing);
      });

      currentTestTypeUnitIds.forEach((unitId) => {
        const unitRows = progressByUnit.get(unitId) ?? [];
        const unitGameMap = new Map<string, ProgressRow>(unitRows.map((r) => [r.game_id, r]));

        const allRequiredDone = requiredGames.every((rg) => {
          const row = unitGameMap.get(rg.game_id);
          if (!row) return false;
          return isEffectivelyCompleted(row);
        });

        if (allRequiredDone) unitsCompleted++;
      });
    } else {
      // Fallback to legacy counting
      const unitCompletionMap = new Map<string, number>();
      progressRows.forEach((p) => {
        if (currentTestTypeUnitIds.has(p.unit_id) && isEffectivelyCompleted(p)) {
          unitCompletionMap.set(p.unit_id, (unitCompletionMap.get(p.unit_id) || 0) + 1);
        }
      });

      const requiredGamesCount = 4;
      unitCompletionMap.forEach((count) => {
        if (count >= requiredGamesCount) unitsCompleted++;
      });
    }

    setUserStats({ avgScore, unitsCompleted });
  };

  const fetchGameHistory = async (unitId: string) => {
    if (!user || gamesConfig.length === 0) return;

    const { data, error } = await supabase
      .from("game_attempts")
      .select("id, game_id, score, created_at")
      .eq("user_id", user.id)
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching game history:", error);
      return;
    }

    const historyByGame: Record<string, Array<{ id: string; score: number; created_at: string }>> = {};
    data?.forEach((attempt) => {
      // Map game_id back to game_type for GameCard compatibility
      const gameConfig = gamesConfig.find(g => g.game_id === attempt.game_id);
      const gameType = gameConfig?.game_type || attempt.game_id;
      
      if (!historyByGame[gameType]) {
        historyByGame[gameType] = [];
      }
      historyByGame[gameType].push({
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

    // Build section stats
    const sortedSections = getSortedSections();
    const sectionStats: SectionStats[] = sortedSections.map(section => ({
      sectionName: section.name,
      completedGames: 0,
      totalGames: groupedGames[section.code]?.games.length || 0,
    }));

    const formattedUnits: Unit[] = data.map((unit, index) => ({
      id: unit.id,
      unitNumber: unit.unit_number,
      title: unit.title,
      description: unit.description || "Master vocabulary through interactive games",
      totalWords: Array.isArray(unit.words) ? unit.words.length : 10,
      sectionStats,
      totalXp: 0,
      isUnlocked: index === 0 && index < maxUnitsPerTestType,
    }));

    setUnits(formattedUnits);
    if (formattedUnits.length > 0) {
      const unitToSelect = selectedUnitId
        ? formattedUnits.find((u) => u.id === selectedUnitId) || formattedUnits[0]
        : formattedUnits[0];
      setSelectedUnit(unitToSelect);
    }
  };

  const fetchUnitsWithProgress = async () => {
    if (!user || !selectedTestType || gamesConfig.length === 0) return;

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

    // Build a map of unit_id -> progress array
    const unitProgressMap = new Map<string, typeof progressData>();
    progressData?.forEach((p) => {
      const existing = unitProgressMap.get(p.unit_id) || [];
      existing.push(p);
      unitProgressMap.set(p.unit_id, existing);
    });

    // For unit unlock, use required_for_unlock field from database
    const requiredGames = getRequiredGames();
    const requiredGameIds = new Set(requiredGames.map(g => g.game_id));

    // Get sorted sections
    const sortedSections = getSortedSections();

    // Create a map of game_id to section_code
    const gameToSectionMap = new Map<string, string>();
    Object.entries(groupedGames).forEach(([sectionCode, sectionData]) => {
      sectionData.games.forEach(game => {
        gameToSectionMap.set(game.game_id, sectionCode);
      });
    });

    // Build a map of game_id to max_attempts for quick lookup
    const gameMaxAttemptsMap = new Map<string, number | null>();
    gamesConfig.forEach(game => {
      const maxAttempts = (game.rules as any)?.max_attempts;
      gameMaxAttemptsMap.set(
        game.game_id,
        typeof maxAttempts === 'number' ? maxAttempts : null
      );
    });

    // Helper to check if a game should be considered "completed" for stats
    const isGameEffectivelyCompleted = (p: { game_id: string; completed: boolean; attempts: number; best_score: number }) => {
      const maxAttempts = gameMaxAttemptsMap.get(p.game_id);
      // For single-attempt games, treat as completed if attempted
      if (maxAttempts === 1 && (p.attempts > 0 || p.best_score > 0)) {
        return true;
      }
      return p.completed;
    };

    const formattedUnits: Unit[] = unitsData.map((unit, index) => {
      const unitProgress = unitProgressMap.get(unit.id) || [];
      const totalXp = unitProgress.reduce((sum, p) => sum + (p.total_xp || 0), 0);

      // Calculate section stats
      const sectionStats: SectionStats[] = sortedSections.map(section => {
        const sectionGames = groupedGames[section.code]?.games || [];
        const sectionGameIds = new Set(sectionGames.map(g => g.game_id));
        const completedInSection = unitProgress.filter(
          p => isGameEffectivelyCompleted(p) && sectionGameIds.has(p.game_id)
        ).length;
        
        return {
          sectionName: section.name,
          completedGames: completedInSection,
          totalGames: sectionGames.length,
        };
      });

      // Check subscription limit first
      const isWithinSubscriptionLimit = index < maxUnitsPerTestType;
      
      let isUnlocked = index === 0 && isWithinSubscriptionLimit;
      if (index > 0 && isWithinSubscriptionLimit) {
        const prevUnitId = unitsData[index - 1].id;
        const prevProgress = unitProgressMap.get(prevUnitId) || [];
        
        // Check if all required_for_unlock games are completed in the previous unit
        const completedRequiredGames = prevProgress.filter(
          (p) => isGameEffectivelyCompleted(p) && requiredGameIds.has(p.game_id)
        ).length;
        isUnlocked = requiredGames.length > 0 && completedRequiredGames >= requiredGames.length;
      }

      return {
        id: unit.id,
        unitNumber: unit.unit_number,
        title: unit.title,
        description: unit.description || "Master vocabulary through interactive games",
        totalWords: Array.isArray(unit.words) ? unit.words.length : 10,
        sectionStats,
        totalXp,
        isUnlocked,
        isPremiumLocked: !isWithinSubscriptionLimit,
      };
    });

    setUnits(formattedUnits);
    if (formattedUnits.length > 0) {
      const unitToSelect = selectedUnitId
        ? formattedUnits.find((u) => u.id === selectedUnitId) || formattedUnits[0]
        : formattedUnits[0];
      setSelectedUnit(unitToSelect);
    }
  };

  const fetchGameProgress = async (unitId: string) => {
    if (!user || gamesConfig.length === 0) return;

    const { data, error } = await supabase
      .from("user_progress")
      .select("game_id, best_score, completed, total_xp, total_time_seconds, attempts")
      .eq("user_id", user.id)
      .eq("unit_id", unitId);

    if (error) {
      console.error("Error fetching game progress:", error);
      return;
    }

    const progress: Record<string, GameProgress> = {};

    data?.forEach((record) => {
      // Map game_id to game_type for backwards compatibility
      const gameConfig = gamesConfig.find(g => g.game_id === record.game_id);
      const gameType = gameConfig?.game_type || record.game_id;
      
      progress[gameType] = {
        gameId: record.game_id,
        bestScore: record.best_score || 0,
        completed: record.completed || false,
        totalXp: record.total_xp || 0,
        totalTimeSeconds: record.total_time_seconds || 0,
        attempts: record.attempts || 0,
      };
    });

    setGameProgress(progress);
    
    // Fetch active (incomplete) test sessions for this unit
    await fetchActiveSessions(unitId);
  };

  const fetchActiveSessions = async (unitId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("game_attempts")
      .select("game_id, started_at, total_duration_seconds")
      .eq("user_id", user.id)
      .eq("unit_id", unitId)
      .eq("completed", false)
      .not("started_at", "is", null);

    if (error) {
      console.error("Error fetching active sessions:", error);
      return;
    }

    const sessionTimes: Record<string, number> = {};
    const now = Date.now();

    data?.forEach((session) => {
      if (session.started_at && session.total_duration_seconds) {
        const startedAt = new Date(session.started_at).getTime();
        const expiresAt = startedAt + (session.total_duration_seconds * 1000);
        const remainingMs = expiresAt - now;
        // Only mark as active if not yet expired
        if (remainingMs > 0) {
          sessionTimes[session.game_id] = Math.floor(remainingMs / 1000);
        }
      }
    });

    setActiveSessionTimes(sessionTimes);
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
      gameId: progress?.gameId || gamesConfig.find(g => g.game_type === gameType)?.game_id || '',
    };
  };

  // Get sorted sections
  const sortedSections = getSortedSections();
  
  // Build games by section dynamically
  const gamesBySection: Record<string, Array<{
    title: string;
    description: string;
    gameType: string;
    gameId: string;
    progress: number;
    isCompleted: boolean;
    isLocked: boolean;
    totalXp: number;
    totalTimeSeconds: number;
    attempts: number;
    icon: React.ComponentType<{ className?: string }>;
    contributesToXp: boolean;
    maxAttempts: number | null;
  }>> = {};

  // Check if all games in previous sections are completed
  const getSectionUnlockStatus = (sectionDisplayOrder: number): boolean => {
    if (sectionDisplayOrder <= 1) return true; // First section is always unlocked
    
    // Check all games in sections with lower display order
    for (const section of sortedSections) {
      if (section.displayOrder < sectionDisplayOrder) {
        const sectionGames = groupedGames[section.code]?.games || [];
        const allCompleted = sectionGames.every(g => {
          const progress = gameProgress[g.game_type];
          return progress?.completed;
        });
        if (!allCompleted) return false;
      }
    }
    return true;
  };

  sortedSections.forEach(section => {
    const sectionGames = groupedGames[section.code]?.games || [];
    const sectionUnlocked = getSectionUnlockStatus(section.displayOrder);

    gamesBySection[section.code] = sectionGames.map(game => {
      const data = getGameData(game.game_type);

      const maxAttemptsRaw = (game.rules as any)?.max_attempts;
      const maxAttempts =
        typeof maxAttemptsRaw === "number"
          ? maxAttemptsRaw
          : typeof maxAttemptsRaw === "string" && maxAttemptsRaw.trim() !== ""
            ? Number(maxAttemptsRaw)
            : null;

      const isSingleAttemptTest = maxAttempts === 1;
      const isAttemptUsed = isSingleAttemptTest && (data.attempts > 0 || data.progress > 0);

      return {
        title: game.game_name,
        description: game.description || '',
        gameType: game.game_type,
        gameId: game.game_id,
        progress: data.progress,
        // For single-attempt tests, treat any attempt as completed (locks the game)
        isCompleted: data.isCompleted || isAttemptUsed,
        isLocked: !sectionUnlocked,
        totalXp: data.totalXp,
        totalTimeSeconds: data.totalTimeSeconds,
        attempts: data.attempts,
        icon: getGameIcon(game.icon_name),
        contributesToXp: game.contributes_to_xp,
        requiredForUnlock: game.required_for_unlock,
        maxAttempts,
      };
    });
  });

  // Helper to check if previous section is completed
  const isPrevSectionCompleted = (sectionIndex: number): boolean => {
    if (sectionIndex <= 0) return true;
    const prevSection = sortedSections[sectionIndex - 1];
    const prevGames = gamesBySection[prevSection.code] || [];
    return prevGames.every(g => g.isCompleted);
  };

  // Helper to get section icon based on code
  const getSectionIcon = (code: string, isUnlocked: boolean) => {
    if (!isUnlocked) return Lock;
    switch (code) {
      case 'learn': return BookOpen;
      case 'challenge': return Trophy;
      default: return Target;
    }
  };

  // Helper to get section color based on code
  const getSectionColor = (code: string, isUnlocked: boolean) => {
    if (!isUnlocked) return 'text-muted-foreground';
    switch (code) {
      case 'learn': return 'text-primary';
      case 'challenge': return 'text-amber-500';
      default: return 'text-emerald-500';
    }
  };

  // Helper to get section description
  const getSectionDescription = (code: string, isUnlocked: boolean, prevSectionName?: string) => {
    if (!isUnlocked && prevSectionName) {
      return `Complete all ${prevSectionName} games to unlock`;
    }
    switch (code) {
      case 'learn': return 'Practice and master vocabulary';
      case 'challenge': return 'Earn XP and level up';
      default: return 'Complete to unlock next unit';
    }
  };

  // First section games for simplified Learn display
  const firstSection = sortedSections[0];
  const learnGames = firstSection ? gamesBySection[firstSection.code] || [] : [];

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

  if (gamesLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading games...</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <StatsCard {...stats[0]} action={<LeaderboardDialog />} />
          <StreakChart />
          <WordStruggleAnalytics />
        </div>

        {/* Current Unit Progress */}
        {currentUnit && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-2xl font-bold">Current Unit: {currentUnit.unitNumber}</h2>
            </div>

            {/* First Section (Learn) - Simple button layout */}
            {firstSection && learnGames.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-primary">
                    <BookOpen className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">{firstSection.name}</h3>
                  </div>
                  <span className="text-sm text-muted-foreground">Practice and master vocabulary</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {learnGames.map((game) => (
                    <Button
                      key={game.title}
                      variant="outline"
                      className={`h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary/50 transition-all relative ${game.isCompleted ? 'border-green-500/50 bg-green-500/5' : ''}`}
                      onClick={() => onStartGame && onStartGame(game.gameType, currentUnit.id, `Unit ${currentUnit.unitNumber}`, false, game.gameId)}
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
            )}

            {/* Dynamic Sections (skip first section which is rendered above) */}
            {sortedSections.slice(1).map((section, index) => {
              const sectionGames = gamesBySection[section.code] || [];
              if (sectionGames.length === 0) return null;
              
              const sectionIndex = index + 1; // Account for skipped first section
              const isUnlocked = isPrevSectionCompleted(sectionIndex);
              const prevSection = sortedSections[sectionIndex - 1];
              const SectionIcon = getSectionIcon(section.code, isUnlocked);
              const sectionColor = getSectionColor(section.code, isUnlocked);
              const sectionDesc = getSectionDescription(section.code, isUnlocked, prevSection?.name);

              return (
                <div key={section.code} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 ${sectionColor}`}>
                      <SectionIcon className="h-5 w-5" />
                      <h3 className="text-lg font-semibold">{section.name}</h3>
                    </div>
                    {isUnlocked ? (
                      <span className="text-sm text-muted-foreground">{sectionDesc}</span>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {sectionDesc}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                    {sectionGames.map((game) => (
                      <GameCard
                        key={game.title}
                        title={game.title}
                        description={game.description}
                        gameType={game.gameType}
                        progress={game.progress}
                        isCompleted={game.isCompleted}
                        isLocked={!isUnlocked}
                        totalXp={game.totalXp}
                        totalTimeSeconds={game.totalTimeSeconds}
                        attempts={game.attempts}
                        history={gameHistory[game.gameType] || []}
                        activeSessionTimeRemaining={activeSessionTimes[game.gameId] ?? null}
                        maxAttempts={game.maxAttempts}
                        sectionCode={section.code}
                        onPlay={() => {
                          if (isUnlocked && (!game.isCompleted || game.maxAttempts !== 1)) {
                            if (onStartGame && currentUnit) {
                              // Show confirmation dialog for test games (single attempt)
                              if (game.maxAttempts === 1 && !activeSessionTimes[game.gameId]) {
                                setTestConfirmDialog({
                                  open: true,
                                  gameType: game.gameType,
                                  gameId: game.gameId,
                                  gameName: game.title,
                                });
                              } else {
                                const playAllWordsOnStart =
                                  game.isCompleted &&
                                  (game.gameType === "listening" ||
                                    game.gameType === "speaking" ||
                                    game.gameType === "writing");

                                onStartGame(game.gameType, currentUnit.id, `Unit ${currentUnit.unitNumber}`, playAllWordsOnStart, game.gameId);
                              }
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Units Grid */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-bold">All Units</h2>
              <Badge variant="secondary" className="gap-1">
                <Target className="h-3 w-3" />
                {units.filter(u => u.sectionStats.every(s => s.totalGames > 0 && s.completedGames === s.totalGames)).length}/{units.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAllUnits(!showAllUnits)}>
              {showAllUnits ? "Less" : "View All"}
              <ArrowRight className={`h-4 w-4 ml-1 sm:ml-2 transition-transform ${showAllUnits ? "rotate-90" : ""}`} />
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
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

        {/* Test Confirmation Dialog */}
        <AlertDialog 
          open={testConfirmDialog?.open ?? false} 
          onOpenChange={(open) => !open && setTestConfirmDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Start {testConfirmDialog?.gameName}?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This test allows <strong>only one attempt</strong>. Once you start, you cannot retake it.
                </p>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
                  <strong>Important:</strong> Make sure you're ready before starting. Your score will be final.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (testConfirmDialog && onStartGame && currentUnit) {
                    onStartGame(
                      testConfirmDialog.gameType, 
                      currentUnit.id, 
                      `Unit ${currentUnit.unitNumber}`, 
                      false, 
                      testConfirmDialog.gameId
                    );
                  }
                  setTestConfirmDialog(null);
                }}
                className="bg-primary hover:bg-primary/90"
              >
                I'm Ready, Start Test
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
