import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Trophy, Zap, Target } from "lucide-react";

interface UnitCardProps {
  unitNumber: number;
  title: string;
  description: string;
  totalWords: number;
  completedGames: number;
  totalGames: number;
  totalXp: number;
  isUnlocked: boolean;
  isSelected?: boolean;
  onEnter: () => void;
}

export const UnitCard = ({
  unitNumber,
  title,
  description,
  totalWords,
  completedGames,
  totalGames,
  totalXp,
  isUnlocked,
  isSelected,
  onEnter,
}: UnitCardProps) => {
  const progress = (completedGames / totalGames) * 100;
  const isCompleted = completedGames === totalGames;

  return (
    <Card
      className={`group relative overflow-hidden border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-card animate-slide-up ${
        isSelected
          ? "border-primary shadow-md shadow-primary/20 ring-1 ring-primary/30"
          : "border-border/50 hover:border-primary/30"
      }`}
    >
      {/* Selected indicator */}
      {isSelected && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-primary" />}

      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Unit number badge */}
      <div className="absolute -top-1.5 -right-1.5">
        <div
          className={`
          w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
          ${
            isCompleted
              ? "bg-gradient-success text-success-foreground"
              : isUnlocked
                ? "bg-gradient-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }
          shadow-md
        `}
        >
          {unitNumber}
        </div>
      </div>

      <div className="relative p-4 space-y-3">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            {isCompleted && <Trophy className="h-4 w-4 text-success fill-current" />}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-accent" />
            <span className="text-muted-foreground">Words:</span>
            <span className="font-medium">{totalWords}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">XP:</span>
            <span className="font-medium">{totalXp}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Games: {completedGames}/{totalGames}
            </span>
          </div>
          <Progress value={progress} className="h-2 bg-muted/50" />
        </div>

        {/* Action Button */}
        <Button
          onClick={onEnter}
          disabled={!isUnlocked}
          variant={isCompleted ? "success" : isUnlocked ? "hero" : "ghost"}
          className="w-full"
          size="sm"
        >
          {!isUnlocked ? (
            "🔒 Locked"
          ) : isCompleted ? (
            <>
              <Trophy className="h-3.5 w-3.5 mr-1.5" />
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
