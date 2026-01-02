import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  Trophy,
  Star,
  Lock,
  Zap,
  Clock,
  Target,
  Layers,
  History,
  Calendar,
} from "lucide-react";

interface GameHistoryEntry {
  id: string;
  score: number;
  created_at: string;
}

interface GameCardProps {
  title: string;
  description: string;
  gameType: "reading" | "listening" | "speaking" | "writing" | "flashcards";
  progress: number;
  isCompleted: boolean;
  isLocked: boolean;
  onPlay: () => void;
  totalXp?: number;
  totalTimeSeconds?: number;
  attempts?: number;
  history?: GameHistoryEntry[];
}

const gameIcons = {
  reading: BookOpen,
  listening: Headphones,
  speaking: Mic,
  writing: PenTool,
  flashcards: Layers,
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
};

export const GameCard = ({
  title,
  description,
  gameType,
  progress,
  isCompleted,
  isLocked,
  onPlay,
  totalXp = 0,
  totalTimeSeconds = 0,
  attempts = 0,
  history = [],
}: GameCardProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const Icon = gameIcons[gameType];
  const hasStats = totalXp > 0 || attempts > 0;

  return (
    <>
      <Card className="group relative overflow-hidden border-2 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up">
        {/* History Badge - Top Right */}
        {!isLocked && history.length > 0 && (
          <Badge
            variant="secondary"
            className="absolute top-1 right-1 z-10 cursor-pointer hover:bg-secondary/80 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setShowHistory(true);
            }}
          >
            <History className="h-3 w-3" />
            {history.length}
          </Badge>
        )}

        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isLocked ? "bg-muted" : "bg-primary/10"} transition-colors`}>
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
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

          {/* Game Stats */}
          {!isLocked && hasStats && (
            <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-primary">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{totalXp}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">XP</span>
              </div>
              <div className="flex flex-col items-center border-x border-border/50">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{formatTime(totalTimeSeconds)}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Time</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{attempts}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Plays</span>
              </div>
            </div>
          )}

          {/* Progress */}
          {!isLocked && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Best Score</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-muted/50" />
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

      {/* Game History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {title} History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {history.map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    #{index + 1}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold text-lg ${entry.score >= 80 ? "text-success" : entry.score >= 50 ? "text-warning" : "text-destructive"}`}
                  >
                    {entry.score}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
