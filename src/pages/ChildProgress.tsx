import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { 
  ArrowLeft, 
  Trophy, 
  Flame, 
  BookOpen, 
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";

interface ChildProfile {
  username: string;
  avatar_url: string | null;
}

interface ChildStats {
  total_xp: number;
  level: number;
  study_streak: number;
  last_study_date: string | null;
  test_type_id: string;
}

interface Game {
  id: string;
  game_type: string;
  name: string;
}

interface GameAttempt {
  id: string;
  game_id: string;
  game_type: string; // Derived from games table
  score: number;
  correct_answers: number;
  total_questions: number;
  time_spent_seconds: number;
  created_at: string;
  unit_id: string;
}

interface UnitProgress {
  id: string;
  unit_id: string;
  game_id: string;
  game_type: string; // Derived from games table
  attempts: number;
  best_score: number;
  total_xp: number;
  completed: boolean;
}

interface Unit {
  id: string;
  title: string;
  unit_number: number;
  test_type_id: string;
}

interface TestType {
  id: string;
  name: string;
  code: string;
}

interface WordStruggleData {
  word: string;
  incorrectCount: number;
  unitNumber: number;
  gameTypes: string[];
}

// Learning games: vocabulary building, practice
const LEARNING_GAMES = ['flashcards', 'matching', 'oddoneout', 'intuition'];
// Compete games: active recall, dictation, comprehension
const COMPETE_GAMES = ['listening', 'speaking', 'reading', 'writing'];

const ChildProgress = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user, currentRole } = useAuth();
  const { canViewProgressReports } = useSubscription();
  
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [allChildStats, setAllChildStats] = useState<ChildStats[]>([]);
  const [allAttempts, setAllAttempts] = useState<GameAttempt[]>([]);
  const [unitProgress, setUnitProgress] = useState<UnitProgress[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [requiredGamesByTestType, setRequiredGamesByTestType] = useState<Map<string, Set<string>>>(new Map());
  const [selectedTestType, setSelectedTestType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [childEmail, setChildEmail] = useState<string>("");
  const [wordStruggleData, setWordStruggleData] = useState<WordStruggleData[]>([]);
  const [wordStruggleLoading, setWordStruggleLoading] = useState(true);

  useEffect(() => {
    if (!user || currentRole !== 'parent') {
      navigate("/parent-auth");
      return;
    }

    if (!canViewProgressReports) {
      navigate("/parent-dashboard");
      return;
    }

    fetchChildData();
  }, [user, currentRole, childId, canViewProgressReports]);

  const fetchChildData = async () => {
    if (!childId) return;

    try {
      // Verify parent has access to this child
      const { data: parentProfile } = await supabase
        .from("parent_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!parentProfile) {
        navigate("/parent-dashboard");
        return;
      }

      const { data: childLink } = await supabase
        .from("parent_children")
        .select("student_email")
        .eq("parent_id", parentProfile.id)
        .eq("student_user_id", childId)
        .eq("relationship_status", "active")
        .single();

      if (!childLink) {
        navigate("/parent-dashboard");
        return;
      }

      setChildEmail(childLink.student_email);

      // Fetch games and test_type_games first to build lookup maps
      const [gamesResult, testTypeGamesResult] = await Promise.all([
        supabase.from("games").select("id, game_type, name"),
        supabase.from("test_type_games").select("game_id, test_type_id, required_for_unlock")
      ]);

      const gamesList = gamesResult.data || [];
      setGames(gamesList);

      // Build game_id to game_type map
      const gameIdToType = new Map(gamesList.map(g => [g.id, g.game_type]));

      // Fetch all data in parallel
      const [profileResult, statsResult, attemptsResult, progressResult, unitsResult, testTypesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", childId)
          .single(),
        supabase
          .from("leaderboard")
          .select("total_xp, level, study_streak, last_study_date, test_type_id")
          .eq("user_id", childId),
        supabase
          .from("game_attempts")
          .select("id, game_id, score, correct_answers, total_questions, time_spent_seconds, created_at, unit_id")
          .eq("user_id", childId)
          .eq("completed", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("user_progress")
          .select("id, unit_id, game_id, attempts, best_score, total_xp, completed")
          .eq("user_id", childId),
        supabase
          .from("units")
          .select("id, title, unit_number, test_type_id")
          .order("unit_number", { ascending: true }),
        supabase
          .from("test_types")
          .select("id, name, code")
          .eq("is_enabled", true)
          .order("name", { ascending: true })
      ]);

      setChildProfile(profileResult.data);
      setAllChildStats(statsResult.data || []);
      
      // Map game_id to game_type for attempts
      const mappedAttempts: GameAttempt[] = (attemptsResult.data || []).map(a => ({
        ...a,
        game_type: gameIdToType.get(a.game_id) || 'unknown'
      }));
      setAllAttempts(mappedAttempts);

      // Map game_id to game_type for progress
      const mappedProgress: UnitProgress[] = (progressResult.data || []).map(p => ({
        ...p,
        game_type: gameIdToType.get(p.game_id) || 'unknown'
      }));
      setUnitProgress(mappedProgress);
      
      setUnits(unitsResult.data || []);
      setTestTypes(testTypesResult.data || []);

      // Build required games map by test type
      const reqGamesMap = new Map<string, Set<string>>();
      (testTypeGamesResult.data || []).forEach((ttg: { game_id: string; test_type_id: string; required_for_unlock: boolean }) => {
        if (ttg.required_for_unlock) {
          if (!reqGamesMap.has(ttg.test_type_id)) {
            reqGamesMap.set(ttg.test_type_id, new Set());
          }
          reqGamesMap.get(ttg.test_type_id)!.add(ttg.game_id);
        }
      });
      setRequiredGamesByTestType(reqGamesMap);

      // Set default selected test type (first one with stats, or first available)
      if (testTypesResult.data && testTypesResult.data.length > 0) {
        const firstWithStats = statsResult.data?.find(s => s.test_type_id);
        setSelectedTestType(firstWithStats?.test_type_id || testTypesResult.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching child data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get units for selected test type
  const filteredUnits = useMemo(() => {
    return units.filter(u => u.test_type_id === selectedTestType);
  }, [units, selectedTestType]);

  // Fetch word struggle data when selected test type changes
  useEffect(() => {
    if (selectedTestType && childId && filteredUnits.length > 0) {
      fetchWordStruggleData();
    }
  }, [selectedTestType, childId, filteredUnits.length]);

  const fetchWordStruggleData = async () => {
    if (!childId || !selectedTestType || filteredUnits.length === 0) return;
    setWordStruggleLoading(true);

    try {
      const unitIds = filteredUnits.map(u => u.id);
      const unitMap: Record<string, number> = {};
      filteredUnits.forEach(u => {
        unitMap[u.id] = u.unit_number;
      });

      // Get child's attempts
      const { data: attempts } = await supabase
        .from("game_attempts")
        .select("id, game_id, unit_id")
        .eq("user_id", childId)
        .in("unit_id", unitIds);

      if (!attempts || attempts.length === 0) {
        setWordStruggleData([]);
        setWordStruggleLoading(false);
        return;
      }

      const attemptIds = attempts.map(a => a.id);
      const attemptUnitMap: Record<string, string> = {};
      attempts.forEach(a => {
        attemptUnitMap[a.id] = a.unit_id;
      });

      // Fetch incorrect answers from both tables
      const [incorrectAnswersResult, dictationIncorrectResult, gamesResult] = await Promise.all([
        supabase
          .from("attempt_incorrect_answers")
          .select("id, attempt_id, question_id, created_at")
          .in("attempt_id", attemptIds),
        supabase
          .from("attempt_incorrect_answers_dictation")
          .select("id, attempt_id, incorrect_word, created_at")
          .in("attempt_id", attemptIds),
        supabase.from("games").select("id, game_type")
      ]);

      const incorrectAnswers = incorrectAnswersResult.data || [];
      const dictationIncorrect = dictationIncorrectResult.data || [];

      // Get question IDs for word lookup
      const questionIds = [...new Set(incorrectAnswers.map(a => a.question_id))];
      let questionWordMap: Record<string, { word: string; unitId: string }> = {};

      if (questionIds.length > 0) {
        const { data: questions } = await supabase
          .from("question_bank")
          .select("id, word, unit_id")
          .in("id", questionIds);

        if (questions) {
          questions.forEach(q => {
            if (q.word) {
              questionWordMap[q.id] = { word: q.word, unitId: q.unit_id };
            }
          });
        }
      }

      // Build game type map
      const gameMap: Record<string, string> = {};
      (gamesResult.data || []).forEach(g => {
        gameMap[g.id] = g.game_type;
      });

      const attemptGameMap: Record<string, string> = {};
      attempts.forEach(a => {
        attemptGameMap[a.id] = a.game_id;
      });

      // Aggregate word struggle data
      const wordIncorrectMap: Record<string, {
        count: number;
        gameTypes: Set<string>;
        unitNumber: number;
      }> = {};

      // Process quiz-based incorrect answers
      incorrectAnswers.forEach(ia => {
        const questionInfo = questionWordMap[ia.question_id];
        if (questionInfo?.word) {
          const key = questionInfo.word.toLowerCase();
          if (!wordIncorrectMap[key]) {
            wordIncorrectMap[key] = {
              count: 0,
              gameTypes: new Set(),
              unitNumber: unitMap[questionInfo.unitId] || 0
            };
          }
          wordIncorrectMap[key].count++;
          const gameId = attemptGameMap[ia.attempt_id];
          if (gameId && gameMap[gameId]) {
            wordIncorrectMap[key].gameTypes.add(gameMap[gameId]);
          }
        }
      });

      // Process dictation-based incorrect answers
      dictationIncorrect.forEach(ia => {
        const attemptUnitId = attemptUnitMap[ia.attempt_id];
        const key = ia.incorrect_word.toLowerCase();
        if (!wordIncorrectMap[key]) {
          wordIncorrectMap[key] = {
            count: 0,
            gameTypes: new Set(),
            unitNumber: unitMap[attemptUnitId] || 0
          };
        }
        wordIncorrectMap[key].count++;
        const gameId = attemptGameMap[ia.attempt_id];
        if (gameId && gameMap[gameId]) {
          wordIncorrectMap[key].gameTypes.add(gameMap[gameId]);
        }
      });

      // Convert to array and sort by count
      const wordDataArray: WordStruggleData[] = Object.entries(wordIncorrectMap)
        .map(([word, data]) => ({
          word,
          incorrectCount: data.count,
          unitNumber: data.unitNumber,
          gameTypes: Array.from(data.gameTypes)
        }))
        .sort((a, b) => b.incorrectCount - a.incorrectCount);

      setWordStruggleData(wordDataArray);
    } catch (error) {
      console.error("Error fetching word struggle data:", error);
    } finally {
      setWordStruggleLoading(false);
    }
  };

  // Get unit IDs for selected test type
  const filteredUnitIds = useMemo(() => {
    return new Set(filteredUnits.map(u => u.id));
  }, [filteredUnits]);

  // Get stats for selected test type
  const childStats = useMemo(() => {
    return allChildStats.find(s => s.test_type_id === selectedTestType) || null;
  }, [allChildStats, selectedTestType]);

  // Filter attempts by test type (through units)
  const filteredAttempts = useMemo(() => {
    return allAttempts.filter(a => filteredUnitIds.has(a.unit_id));
  }, [allAttempts, filteredUnitIds]);

  // Get recent attempts (last 10)
  const recentAttempts = useMemo(() => {
    return filteredAttempts.slice(0, 10);
  }, [filteredAttempts]);

  // Filter progress by test type (through units)
  const filteredProgress = useMemo(() => {
    return unitProgress.filter(p => filteredUnitIds.has(p.unit_id));
  }, [unitProgress, filteredUnitIds]);

  // Get attempts from last 7 days for chart
  const last7DaysAttempts = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return filteredAttempts.filter(a => new Date(a.created_at) >= sevenDaysAgo);
  }, [filteredAttempts]);

  const getUnitTitle = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    return unit ? `Unit ${unit.unit_number}: ${unit.title}` : "Unknown Unit";
  };

  const formatGameType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const displayName = childProfile?.username || childEmail.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  // Calculate stats for selected test type
  const totalAttempts = filteredProgress.reduce((sum, p) => sum + p.attempts, 0);
  
  // Count units where ALL required games are completed
  const completedUnits = useMemo(() => {
    const requiredGames = requiredGamesByTestType.get(selectedTestType);
    if (!requiredGames || requiredGames.size === 0) {
      // Fallback: count units with any completed game
      return new Set(filteredProgress.filter(p => p.completed).map(p => p.unit_id)).size;
    }

    // Group progress by unit_id
    const progressByUnit = new Map<string, Set<string>>();
    filteredProgress.forEach(p => {
      if (p.completed && requiredGames.has(p.game_id)) {
        if (!progressByUnit.has(p.unit_id)) {
          progressByUnit.set(p.unit_id, new Set());
        }
        progressByUnit.get(p.unit_id)!.add(p.game_id);
      }
    });

    // Count units where ALL required games are completed
    let count = 0;
    progressByUnit.forEach((completedGameIds, unitId) => {
      // Check that every required game is in the completed set
      let allCompleted = true;
      requiredGames.forEach(gameId => {
        if (!completedGameIds.has(gameId)) {
          allCompleted = false;
        }
      });
      if (allCompleted) {
        count++;
      }
    });
    return count;
  }, [filteredProgress, requiredGamesByTestType, selectedTestType]);

  // Get required games count for the selected test type
  const requiredGamesCount = useMemo(() => {
    const requiredGames = requiredGamesByTestType.get(selectedTestType);
    return requiredGames?.size || 8;
  }, [requiredGamesByTestType, selectedTestType]);

  const averageScore = recentAttempts.length > 0
    ? Math.round(recentAttempts.reduce((sum, a) => sum + a.score, 0) / recentAttempts.length)
    : 0;

  // Calculate daily time breakdown for learning vs compete games
  const dailyTimeData = useMemo(() => {
    const last7Days: { date: string; learning: number; compete: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      last7Days.push({
        date: format(day, 'EEE'),
        learning: 0,
        compete: 0,
      });
    }

    last7DaysAttempts.forEach(attempt => {
      const attemptDate = format(parseISO(attempt.created_at), 'yyyy-MM-dd');
      const dayIndex = last7Days.findIndex((_, i) => 
        format(subDays(new Date(), 6 - i), 'yyyy-MM-dd') === attemptDate
      );
      
      if (dayIndex !== -1) {
        const timeInMinutes = Math.round(attempt.time_spent_seconds / 60);
        if (LEARNING_GAMES.includes(attempt.game_type)) {
          last7Days[dayIndex].learning += timeInMinutes;
        } else if (COMPETE_GAMES.includes(attempt.game_type)) {
          last7Days[dayIndex].compete += timeInMinutes;
        } else {
          last7Days[dayIndex].learning += timeInMinutes;
        }
      }
    });

    return last7Days;
  }, [last7DaysAttempts]);

  const chartConfig = {
    learning: {
      label: "Learning",
      color: "hsl(var(--primary))",
    },
    compete: {
      label: "Compete",
      color: "hsl(var(--destructive))",
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading progress...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/parent-dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={childProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-bold text-2xl">{displayName}'s Progress</h1>
              <p className="text-muted-foreground">{childEmail}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Test Type Tabs */}
        {testTypes.length > 0 && (
          <Tabs value={selectedTestType} onValueChange={setSelectedTestType}>
            <div className="flex flex-wrap gap-2 mb-6">
              {testTypes.map((tt) => {
                const isActive = selectedTestType === tt.id;
                return (
                  <Button
                    key={tt.id}
                    variant={isActive ? "default" : "outline"}
                    size="lg"
                    onClick={() => setSelectedTestType(tt.id)}
                    className={`rounded-full px-6 ${isActive ? 'shadow-md' : ''}`}
                  >
                    {tt.name}
                  </Button>
                );
              })}
            </div>

            {testTypes.map((tt) => (
              <TabsContent key={tt.id} value={tt.id} className="space-y-8 mt-6">
                {/* Stats Overview */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 bg-warning/10 rounded-lg">
                        <Trophy className="h-6 w-6 text-warning" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{childStats?.level || 1}</p>
                        <p className="text-sm text-muted-foreground">Level</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{childStats?.total_xp || 0}</p>
                        <p className="text-sm text-muted-foreground">Total XP</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 bg-destructive/10 rounded-lg">
                        <Flame className="h-6 w-6 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{childStats?.study_streak || 0}</p>
                        <p className="text-sm text-muted-foreground">Day Streak</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 bg-success/10 rounded-lg">
                        <Target className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{averageScore}%</p>
                        <p className="text-sm text-muted-foreground">Avg Score</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Attempts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{totalAttempts}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Units Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-3xl font-bold">
                        {completedUnits}
                        <span className="text-base text-muted-foreground/70 font-medium ml-1">
                          of {filteredUnits.length}
                        </span>
                      </p>
                      <Progress 
                        value={filteredUnits.length > 0 ? (completedUnits / filteredUnits.length) * 100 : 0} 
                        className="h-2"
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Last Study Date
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">
                        {childStats?.last_study_date 
                          ? format(new Date(childStats.last_study_date), 'MMM d, yyyy')
                          : 'Not yet'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Time Breakdown Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Daily Time Breakdown
                    </CardTitle>
                    <CardDescription>Minutes spent on learning vs. compete games (last 7 days)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {last7DaysAttempts.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        No activity in the last 7 days
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-primary" />
                            <span className="text-sm text-muted-foreground">Learning</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-destructive" />
                            <span className="text-sm text-muted-foreground">Compete</span>
                          </div>
                        </div>
                        <ChartContainer config={chartConfig} className="h-[200px] w-full">
                          <BarChart data={dailyTimeData} barGap={2}>
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="learning" fill="var(--color-learning)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="compete" fill="var(--color-compete)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Unit Progress */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Unit Progress
                    </CardTitle>
                    <CardDescription>Progress across all units</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredUnits.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        No units available
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {filteredUnits.map((unit) => {
                          const requiredGames = requiredGamesByTestType.get(selectedTestType);
                          const unitProgressData = filteredProgress.filter(p => p.unit_id === unit.id);
                          // Only count completed games that are in the required games set
                          const completedGames = unitProgressData.filter(p => 
                            p.completed && requiredGames?.has(p.game_id)
                          ).length;
                          const totalGames = requiredGamesCount;
                          const progressPercent = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;
                          
                          return (
                            <div key={unit.id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  Unit {unit.unit_number}: {unit.title}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {completedGames}/{totalGames}
                                </span>
                              </div>
                              <Progress value={progressPercent} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Words to Practice */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Words to Practice
                    </CardTitle>
                    <CardDescription>Words that need more attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {wordStruggleLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : wordStruggleData.length === 0 ? (
                      <div className="text-center py-8">
                        <Target className="h-8 w-8 mx-auto text-success mb-2" />
                        <p className="text-muted-foreground">
                          Great job! No struggled words recorded yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary stats */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-destructive/10 p-3 text-center">
                            <div className="text-2xl font-bold text-destructive">
                              {wordStruggleData.reduce((sum, w) => sum + w.incorrectCount, 0)}
                            </div>
                            <div className="text-xs text-muted-foreground">Total Mistakes</div>
                          </div>
                          <div className="rounded-lg bg-warning/10 p-3 text-center">
                            <div className="text-2xl font-bold text-warning">
                              {wordStruggleData.length}
                            </div>
                            <div className="text-xs text-muted-foreground">Words to Review</div>
                          </div>
                        </div>

                        {/* Word list */}
                        <div className="space-y-2">
                          {wordStruggleData.slice(0, 10).map((word, index) => (
                            <div
                              key={`${word.word}-${index}`}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium capitalize">{word.word}</span>
                                <Badge variant="outline" className="text-xs">
                                  U{word.unitNumber}
                                </Badge>
                                {word.gameTypes.includes('listening') && (
                                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={Math.min((word.incorrectCount / (wordStruggleData[0]?.incorrectCount || 1)) * 100, 100)} 
                                  className="w-16 h-1.5" 
                                />
                                <span className="text-sm text-destructive font-medium w-6 text-right">
                                  {word.incorrectCount}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {wordStruggleData.length > 10 && (
                          <p className="text-xs text-center text-muted-foreground">
                            +{wordStruggleData.length - 10} more words
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Last 10 game attempts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentAttempts.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        No recent activity
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Game</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentAttempts.map((attempt) => (
                            <TableRow key={attempt.id}>
                              <TableCell className="text-muted-foreground">
                                {format(parseISO(attempt.created_at), 'MMM d, h:mm a')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {formatGameType(attempt.game_type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {getUnitTitle(attempt.unit_id)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={
                                  attempt.score >= 80 ? "text-green-500 font-medium" :
                                  attempt.score >= 50 ? "text-yellow-500 font-medium" :
                                  "text-red-500 font-medium"
                                }>
                                  {attempt.score}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatTime(attempt.time_spent_seconds)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default ChildProgress;
