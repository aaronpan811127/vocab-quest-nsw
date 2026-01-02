import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface DayData {
  day: string;
  minutes: number;
  date: string;
}

export const StreakChart = () => {
  const { user } = useAuth();
  const { selectedTestType } = useTestType();
  const [data, setData] = useState<DayData[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (user && selectedTestType) {
      fetchWeekData();
      fetchStreak();
    }
  }, [user, selectedTestType]);

  const fetchStreak = async () => {
    if (!user || !selectedTestType) return;

    const { data, error } = await supabase
      .from("leaderboard")
      .select("study_streak")
      .eq("user_id", user.id)
      .eq("test_type_id", selectedTestType.id)
      .maybeSingle();

    if (!error && data) {
      setStreak(data.study_streak || 0);
    } else {
      setStreak(0);
    }
  };

  const fetchWeekData = async () => {
    if (!user || !selectedTestType) return;

    // First get unit IDs for this test type
    const { data: testTypeUnits, error: unitsError } = await supabase
      .from("units")
      .select("id")
      .eq("test_type_id", selectedTestType.id);

    if (unitsError || !testTypeUnits?.length) {
      setData([]);
      return;
    }

    const unitIds = testTypeUnits.map(u => u.id);

    // Get last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const { data: attempts, error } = await supabase
      .from("game_attempts")
      .select("created_at, time_spent_seconds, unit_id")
      .eq("user_id", user.id)
      .in("unit_id", unitIds)
      .gte("created_at", sevenDaysAgo.toISOString())
      .lte("created_at", today.toISOString());

    if (error) {
      console.error("Error fetching streak data:", error);
      return;
    }

    // Create a map for each of the last 7 days
    const dayMap = new Map<string, number>();
    const days: DayData[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      dayMap.set(dateKey, 0);
      days.push({ day: dayName, minutes: 0, date: dateKey });
    }

    // Sum up time spent per day
    attempts?.forEach((attempt) => {
      const attemptDate = new Date(attempt.created_at)
        .toISOString()
        .split("T")[0];
      if (dayMap.has(attemptDate)) {
        const current = dayMap.get(attemptDate) || 0;
        dayMap.set(attemptDate, current + (attempt.time_spent_seconds || 0));
      }
    });

    // Update days with actual minutes
    const updatedDays = days.map((d) => ({
      ...d,
      minutes: Math.round((dayMap.get(d.date) || 0) / 60),
    }));

    setData(updatedDays);
  };

  const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);

  const chartConfig = {
    minutes: {
      label: "Minutes",
      color: "hsl(var(--success))",
    },
  };

  return (
    <Card className="p-4 space-y-3 border-2 backdrop-blur-sm transition-all duration-300 hover:shadow-card hover:scale-105 animate-slide-up border-success/20 bg-success/5">
      <div className="flex items-center justify-between">
        <Trophy className="h-5 w-5 text-success" />
        <span className="text-xs font-medium text-muted-foreground">
          Last 7 days
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight">{streak} day streak</p>
        <p className="text-xs text-muted-foreground font-medium">
          Study Activity
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[80px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              interval={0}
            />
            <YAxis hide domain={[0, maxMinutes]} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [`${value} mins`, "Time"]}
                />
              }
            />
            <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.minutes > 0
                      ? "hsl(var(--success))"
                      : "hsl(var(--muted))"
                  }
                  opacity={entry.minutes > 0 ? 1 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  );
};
