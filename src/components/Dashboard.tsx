import { useState, useEffect } from "react";
import { StatsCard } from "./StatsCard";
import { UnitCard } from "./UnitCard";
import { GameCard } from "./GameCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Target, 
  Clock, 
  Zap,
  Crown,
  Users,
  ArrowRight
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

  useEffect(() => {
    fetchUnits();
  }, []);

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

  const displayName = profile?.username || user?.email?.split('@')[0] || 'Player';

  const stats = [
    { title: "Total XP", value: profile?.total_xp?.toLocaleString() || "0", icon: Zap, variant: "primary" as const, trend: "up" as const },
    { title: "Units Completed", value: `0/${units.length}`, icon: Target, variant: "secondary" as const },
    { title: "Study Streak", value: `${profile?.study_streak || 0} days`, icon: Trophy, variant: "success" as const, trend: "up" as const },
    { title: "Avg Score", value: "0%", icon: Crown, variant: "warning" as const },
  ];

  const currentUnit = selectedUnit || units[0];

  const games = [
    {
      title: "Reading Quest",
      description: "Embark on reading adventures with comprehension challenges",
      gameType: "reading" as const,
      progress: 100,
      isCompleted: true,
      isLocked: false,
      difficulty: "Medium" as const,
    },
    {
      title: "Audio Challenge",
      description: "Listen and spell words perfectly to advance",
      gameType: "listening" as const,
      progress: 100,
      isCompleted: true,
      isLocked: false,
      difficulty: "Easy" as const,
    },
    {
      title: "Voice Master",
      description: "Speak clearly and accurately to unlock achievements",
      gameType: "speaking" as const,
      progress: 80,
      isCompleted: false,
      isLocked: false,
      difficulty: "Hard" as const,
    },
    {
      title: "Story Creator",
      description: "Craft creative sentences using your new vocabulary",
      gameType: "writing" as const,
      progress: 0,
      isCompleted: false,
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
            <Button variant="gaming">
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
            <Button variant="outline">
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
    </div>
  );
};