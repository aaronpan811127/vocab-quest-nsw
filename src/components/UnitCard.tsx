import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Trophy, 
  Star,
  Users,
  Clock,
  Target
} from "lucide-react";

interface UnitCardProps {
  unitNumber: number;
  title: string;
  description: string;
  totalWords: number;
  completedGames: number;
  totalGames: number;
  averageScore: number;
  timeSpent: string;
  isUnlocked: boolean;
  onEnter: () => void;
}

export const UnitCard = ({
  unitNumber,
  title,
  description,
  totalWords,
  completedGames,
  totalGames,
  averageScore,
  timeSpent,
  isUnlocked,
  onEnter,
}: UnitCardProps) => {
  const progress = (completedGames / totalGames) * 100;
  const isCompleted = completedGames === totalGames;

  return (
    <Card className="group relative overflow-hidden border-2 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Unit number badge */}
      <div className="absolute -top-2 -right-2">
        <div className={`
          w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold
          ${isCompleted ? 'bg-gradient-success text-success-foreground' : 
            isUnlocked ? 'bg-gradient-primary text-primary-foreground' : 
            'bg-muted text-muted-foreground'}
          shadow-lg
        `}>
          {unitNumber}
        </div>
      </div>

      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-xl">{title}</h3>
            {isCompleted && (
              <Trophy className="h-5 w-5 text-success fill-current" />
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">Words:</span>
            <span className="font-medium">{totalWords}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-secondary" />
            <span className="text-muted-foreground">Time:</span>
            <span className="font-medium">{timeSpent}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Games: {completedGames}/{totalGames}
            </span>
            {averageScore > 0 && (
              <Badge variant="outline" className="gap-1">
                <Star className="h-3 w-3 fill-current text-warning" />
                {averageScore}%
              </Badge>
            )}
          </div>
          <Progress 
            value={progress} 
            className="h-3 bg-muted/50"
          />
        </div>

        {/* Action Button */}
        <Button
          onClick={onEnter}
          disabled={!isUnlocked}
          variant={isCompleted ? "success" : isUnlocked ? "hero" : "ghost"}
          className="w-full"
          size="lg"
        >
          {!isUnlocked ? (
            "🔒 Locked"
          ) : isCompleted ? (
            <>
              <Trophy className="h-4 w-4 mr-2" />
              Review Unit
            </>
          ) : progress > 0 ? (
            "Continue Unit"
          ) : (
            "Start Unit"
          )}
        </Button>
      </div>
    </Card>
  );
};