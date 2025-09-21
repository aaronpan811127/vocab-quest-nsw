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

interface DashboardProps {
  onStartGame?: (gameType: string) => void;
}

export const Dashboard = ({ onStartGame }: DashboardProps) => {
  // Mock data for demonstration
  const stats = [
    { title: "Total XP", value: "2,450", icon: Zap, variant: "primary" as const, trend: "up" as const },
    { title: "Units Completed", value: "3/10", icon: Target, variant: "secondary" as const },
    { title: "Study Streak", value: "7 days", icon: Trophy, variant: "success" as const, trend: "up" as const },
    { title: "Avg Score", value: "87%", icon: Crown, variant: "warning" as const },
  ];

  const units = [
    {
      unitNumber: 1,
      title: "Foundation Words",
      description: "Essential vocabulary building blocks for academic success",
      totalWords: 10,
      completedGames: 4,
      totalGames: 4,
      averageScore: 92,
      timeSpent: "45m",
      isUnlocked: true,
    },
    {
      unitNumber: 2,
      title: "Academic Excellence",
      description: "Advanced terms used in scholarly contexts and examinations",
      totalWords: 10,
      completedGames: 3,
      totalGames: 4,
      averageScore: 85,
      timeSpent: "32m",
      isUnlocked: true,
    },
    {
      unitNumber: 3,
      title: "Literary Mastery",
      description: "Sophisticated vocabulary from classic and modern literature",
      totalWords: 10,
      completedGames: 0,
      totalGames: 4,
      averageScore: 0,
      timeSpent: "0m",
      isUnlocked: true,
    },
    {
      unitNumber: 4,
      title: "Scientific Terms",
      description: "Specialized vocabulary for science and mathematics",
      totalWords: 10,
      completedGames: 0,
      totalGames: 4,
      averageScore: 0,
      timeSpent: "0m",
      isUnlocked: false,
    },
  ];

  const currentUnit = units[1]; // Unit 2 is in progress

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
            <h1 className="text-3xl font-bold">Welcome back, Alex! 🎮</h1>
            <p className="text-muted-foreground mt-1">Ready to level up your vocabulary skills?</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-gradient-success text-success-foreground">
              <Crown className="h-4 w-4 mr-2" />
              Level 12
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
                  if (game.gameType === "reading" && onStartGame) {
                    onStartGame("reading");
                  } else {
                    console.log(`${game.title} coming soon!`);
                  }
                }}
              />
            ))}
          </div>
        </div>

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