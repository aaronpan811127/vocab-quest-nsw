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
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { 
  ArrowLeft, 
  Trophy, 
  Flame, 
  BookOpen, 
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Crown,
  Lock,
  Gamepad2
} from "lucide-react";
import { format, subDays, startOfDay, parseISO } from "date-fns";

interface ChildProfile {
  username: string;
  avatar_url: string | null;
}

interface ChildStats {
  total_xp: number;
  level: number;
  study_streak: number;
  last_study_date: string | null;
}

interface GameAttempt {
  id: string;
  game_type: string;
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
  game_type: string;
  attempts: number;
  best_score: number;
  total_xp: number;
  completed: boolean;
}

interface Unit {
  id: string;
  title: string;
  unit_number: number;
}

// Learning games: vocabulary building, comprehension
const LEARNING_GAMES = ['flashcards', 'matching', 'reading', 'oddoneout', 'word_intuition', 'story'];
// Compete games: active recall, dictation-based
const COMPETE_GAMES = ['listening', 'speaking'];

const ChildProgress = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user, currentRole } = useAuth();
  const { canViewProgressReports } = useSubscription();
  
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [childStats, setChildStats] = useState<ChildStats | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<GameAttempt[]>([]);
  const [allAttempts, setAllAttempts] = useState<GameAttempt[]>([]);
  const [unitProgress, setUnitProgress] = useState<UnitProgress[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
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

      // Get date range for last 7 days
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Fetch all data in parallel
      const [profileResult, statsResult, recentAttemptsResult, allAttemptsResult, progressResult, unitsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", childId)
          .single(),
        supabase
          .from("leaderboard")
          .select("total_xp, level, study_streak, last_study_date")
          .eq("user_id", childId)
          .limit(1),
        supabase
          .from("game_attempts")
          .select("*")
          .eq("user_id", childId)
          .eq("completed", true)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("game_attempts")
          .select("id, game_type, time_spent_seconds, created_at")
          .eq("user_id", childId)
          .eq("completed", true)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", childId),
        supabase
          .from("units")
          .select("id, title, unit_number")
          .order("unit_number", { ascending: true })
      ]);

      setChildProfile(profileResult.data);
      setChildStats(statsResult.data?.[0] || null);
      setRecentAttempts(recentAttemptsResult.data || []);
      setAllAttempts(allAttemptsResult.data as GameAttempt[] || []);
      setUnitProgress(progressResult.data || []);
      setUnits(unitsResult.data || []);
    } catch (error) {
      console.error("Error fetching child data:", error);
    } finally {
      setLoading(false);
    }
  };

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

  // Calculate overall stats
  const totalAttempts = unitProgress.reduce((sum, p) => sum + p.attempts, 0);
  const completedUnits = new Set(unitProgress.filter(p => p.completed).map(p => p.unit_id)).size;
  const averageScore = recentAttempts.length > 0
    ? Math.round(recentAttempts.reduce((sum, a) => sum + a.score, 0) / recentAttempts.length)
    : 0;

  // Calculate daily time breakdown for learning vs compete games
  const dailyTimeData = useMemo(() => {
    const last7Days: { date: string; learning: number; compete: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = format(day, 'yyyy-MM-dd');
      last7Days.push({
        date: format(day, 'EEE'),
        learning: 0,
        compete: 0,
      });
    }

    allAttempts.forEach(attempt => {
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
          // Default to learning for unknown game types
          last7Days[dayIndex].learning += timeInMinutes;
        }
      }
    });

    return last7Days;
  }, [allAttempts]);

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
            <CardContent>
              <p className="text-3xl font-bold">{completedUnits}</p>
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

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Last 10 completed game attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAttempts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No game attempts yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">
                        {format(new Date(attempt.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>{formatGameType(attempt.game_type)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {getUnitTitle(attempt.unit_id)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={attempt.score >= 80 ? "default" : "secondary"}>
                          {attempt.score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.correct_answers}/{attempt.total_questions}
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
            {allAttempts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No activity in the last 7 days
              </p>
            ) : (
              <>
                <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                    <span className="text-sm text-muted-foreground">Learning</span>
                    <span className="text-xs text-muted-foreground">(Flashcards, Matching, Reading, etc.)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-destructive" />
                    <span className="text-sm text-muted-foreground">Compete</span>
                    <span className="text-xs text-muted-foreground">(Listening, Speaking)</span>
                  </div>
                </div>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={dailyTimeData} accessibilityLayer>
                    <XAxis 
                      dataKey="date" 
                      tickLine={false} 
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => `${value}m`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => [`${value} min`, name === 'learning' ? 'Learning' : 'Compete']}
                    />
                    <Bar 
                      dataKey="learning" 
                      fill="var(--color-learning)" 
                      radius={[4, 4, 0, 0]}
                      stackId="time"
                    />
                    <Bar 
                      dataKey="compete" 
                      fill="var(--color-compete)" 
                      radius={[4, 4, 0, 0]}
                      stackId="time"
                    />
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
            {unitProgress.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No unit progress yet
              </p>
            ) : (
              <div className="space-y-4">
                {units.filter(u => unitProgress.some(p => p.unit_id === u.id)).map((unit) => {
                  const progress = unitProgress.filter(p => p.unit_id === unit.id);
                  const totalXP = progress.reduce((sum, p) => sum + p.total_xp, 0);
                  const bestScore = Math.max(...progress.map(p => p.best_score), 0);
                  const isCompleted = progress.some(p => p.completed);
                  
                  return (
                    <div key={unit.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Unit {unit.unit_number}: {unit.title}
                          </span>
                          {isCompleted && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              Completed
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {totalXP} XP earned
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Progress value={bestScore} className="flex-1" />
                        <span className="text-sm font-medium w-12 text-right">
                          {bestScore}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ChildProgress;
