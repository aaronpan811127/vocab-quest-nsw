import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Crown, Lock } from "lucide-react";

interface SectionStats {
  sectionName: string;
  completedGames: number;
  totalGames: number;
}

interface UnitCardProps {
  unitNumber: number;
  title: string;
  description: string;
  totalWords: number;
  sectionStats: SectionStats[];
  totalXp: number;
  isUnlocked: boolean;
  isSelected?: boolean;
  isPremiumLocked?: boolean;
  onEnter: () => void;
}

export const UnitCard = ({
  unitNumber,
  sectionStats,
  totalXp,
  isUnlocked,
  isSelected,
  isPremiumLocked,
  onEnter,
}: UnitCardProps) => {
  const totalGames = sectionStats.reduce((sum, s) => sum + s.totalGames, 0);
  const completedGames = sectionStats.reduce((sum, s) => sum + s.completedGames, 0);
  const progress = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;
  const isCompleted = totalGames > 0 && completedGames === totalGames;

  return (
    <Card
      onClick={() => isUnlocked && onEnter()}
      className={`group relative overflow-hidden border transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : isUnlocked
            ? "border-border/50 hover:border-primary/30 hover:bg-muted/30"
            : "border-border/30 opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="relative p-3 flex items-center gap-3">
        {/* Unit number badge */}
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
            ${
              isCompleted
                ? "bg-success text-success-foreground"
                : isUnlocked
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }
          `}
        >
          {isCompleted ? <Trophy className="h-4 w-4" /> : unitNumber}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {sectionStats.map((section) => (
              <span key={section.sectionName}>
                {section.sectionName}: {section.completedGames}/{section.totalGames}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-medium">{totalXp} XP</span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="shrink-0">
          {isPremiumLocked ? (
            <Crown className="h-4 w-4 text-yellow-500" />
          ) : !isUnlocked ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </div>
      </div>
    </Card>
  );
};
