import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Headphones, 
  Mic, 
  PenTool, 
  Trophy, 
  Star,
  Lock
} from "lucide-react";

interface GameCardProps {
  title: string;
  description: string;
  gameType: "reading" | "listening" | "speaking" | "writing";
  progress: number;
  isCompleted: boolean;
  isLocked: boolean;
  onPlay: () => void;
}

const gameIcons = {
  reading: BookOpen,
  listening: Headphones,
  speaking: Mic,
  writing: PenTool,
};

export const GameCard = ({
  title,
  description,
  gameType,
  progress,
  isCompleted,
  isLocked,
  onPlay,
}: GameCardProps) => {
  const Icon = gameIcons[gameType];

  return (
    <Card className="group relative overflow-hidden border-2 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isLocked ? 'bg-muted' : 'bg-primary/10'} transition-colors`}>
              {isLocked ? (
                <Lock className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Icon className="h-5 w-5 text-primary" />
              )}
            </div>
            <h3 className="font-semibold text-lg">{title}</h3>
          </div>
          
          {isCompleted && (
            <div className="flex items-center gap-1 text-success">
              <Trophy className="h-4 w-4" />
              <Star className="h-4 w-4 fill-current" />
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Progress */}
        {!isLocked && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress 
              value={progress} 
              className="h-2 bg-muted/50" 
            />
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={onPlay}
          disabled={isLocked}
          variant={isCompleted ? "success" : isLocked ? "ghost" : "game"}
          className="w-full"
          size="lg"
        >
          {isLocked ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Complete Previous Games
            </>
          ) : isCompleted ? (
            <>
              <Trophy className="h-4 w-4 mr-2" />
              Play Again
            </>
          ) : progress > 0 ? (
            "Continue"
          ) : (
            "Start Game"
          )}
        </Button>
      </div>
    </Card>
  );
};