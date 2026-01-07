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
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  const [selectedTestType, setSelectedTestType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [childEmail, setChildEmail] = useState<string>("");

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

      // Fetch games first to build lookup map
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, game_type, name");

      const gamesList = gamesData || [];
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
  const completedUnits = new Set(filteredProgress.filter(p => p.completed).map(p => p.unit_id)).size;
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
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <Trophy className="h-6 w-6 text-yellow-500" />
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
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Target className="h-6 w-6 text-green-500" />
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
                          const unitProgressData = filteredProgress.filter(p => p.unit_id === unit.id);
                          const completedGames = unitProgressData.filter(p => p.completed).length;
                          const totalGames = 8; // Total games per unit
                          const progressPercent = (completedGames / totalGames) * 100;
                          
                          return (
                            <div key={unit.id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  Unit {unit.unit_number}: {unit.title}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {completedGames}/{totalGames} games
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
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default ChildProgress;
