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
      <div className="relative p-2 flex flex-col items-center gap-1 text-center">
        {/* Unit number badge */}
        <div
          className={`
            w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${
              isCompleted
                ? "bg-success text-success-foreground"
                : isUnlocked
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }
          `}
        >
          {isCompleted ? <Trophy className="h-3.5 w-3.5" /> : unitNumber}
        </div>

        {/* Section stats */}
        <div className="text-[10px] text-muted-foreground leading-tight">
          {sectionStats.map((s) => (
            <div key={s.sectionName}>{s.completedGames}/{s.totalGames}</div>
          ))}
        </div>

        {/* Status icon */}
        {isPremiumLocked ? (
          <Crown className="h-3 w-3 text-yellow-500" />
        ) : !isUnlocked ? (
          <Lock className="h-3 w-3 text-muted-foreground" />
        ) : (
          <div className="text-[10px] font-medium text-primary">{totalXp}xp</div>
        )}
      </div>
    </Card>
  );
};
