import { useState, useEffect } from "react";
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
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface GameHistoryEntry {
  id: string;
  score: number;
  created_at: string;
}

interface GameCardProps {
  title: string;
  description: string;
  gameType: string;
  progress: number;
  isCompleted: boolean;
  isLocked: boolean;
  onPlay: () => void;
  totalXp?: number;
  totalTimeSeconds?: number;
  attempts?: number;
  history?: GameHistoryEntry[];
  activeSessionTimeRemaining?: number | null; // seconds remaining, null if no active session
  maxAttempts?: number | null; // null means unlimited attempts
  sectionCode?: string; // e.g., 'learn', 'challenge', 'test'
}

const gameIcons: Record<string, React.ComponentType<{ className?: string }>> = {
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

const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  activeSessionTimeRemaining = null,
  maxAttempts = null,
  sectionCode = '',
}: GameCardProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(activeSessionTimeRemaining);
  const Icon = gameIcons[gameType] || Target;
  const hasStats = totalXp > 0 || attempts > 0;
  const hasActiveSession = activeSessionTimeRemaining !== null && activeSessionTimeRemaining > 0;
  
  // Check if this is a single-attempt test that's already been completed
  const isTestCompleted = isCompleted && maxAttempts === 1;
  
  // Calculate average score for challenge section games
  const isChallenge = sectionCode === 'challenge';
  const averageScore = history.length > 0 
    ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length)
    : 0;

  // Sync state when prop changes
  useEffect(() => {
    setTimeRemaining(activeSessionTimeRemaining);
  }, [activeSessionTimeRemaining]);

  // Live countdown effect - use ref to track if interval is running
  useEffect(() => {
    // Only start if we have a valid time remaining
    if (timeRemaining === null || timeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining !== null && timeRemaining > 0]);

  return (
    <>
      <Card className="group relative overflow-hidden border-2 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-card animate-slide-up">

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

            {isCompleted ? (
              <div className="flex items-center gap-1 text-success">
                <Trophy className="h-4 w-4" />
                <Star className="h-4 w-4 fill-current" />
              </div>
            ) : hasActiveSession && timeRemaining !== null ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/20 border border-warning/30 animate-pulse">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-semibold text-warning">
                  {formatTimeRemaining(timeRemaining)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

          {/* Single attempt warning for test games */}
          {maxAttempts === 1 && !isTestCompleted && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <span className="text-xs font-medium text-warning">
                One attempt only – make it count!
              </span>
            </div>
          )}

          {/* Perfect score requirement for learn & challenge games */}
          {(sectionCode === 'learn' || sectionCode === 'challenge') && !isCompleted && maxAttempts !== 1 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
              <Target className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs font-medium text-primary">
                Score 100% to pass this game
              </span>
            </div>
          )}

        {/* Stats - different display based on game type and section */}
        {!isLocked && hasStats && (
          <div className={`grid ${isChallenge ? 'grid-cols-3' : 'grid-cols-2'} gap-2 py-2 px-3 rounded-lg bg-muted/30 border border-border/50`}>
            {maxAttempts === 1 ? (
              // Test games: show Score instead of XP
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-primary">
                  <Trophy className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{progress}%</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Score</span>
              </div>
            ) : (
              // Regular games: show XP
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-primary">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{totalXp}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">XP</span>
              </div>
            )}
            {/* Average score - only for challenge section */}
            {isChallenge && (
              <div className="flex flex-col items-center border-l border-border/50">
                <div className="flex items-center gap-1 text-primary">
                  <Target className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{averageScore}%</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Avg Score</span>
              </div>
            )}
            <div className="flex flex-col items-center border-l border-border/50">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">{formatTime(totalTimeSeconds)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Time</span>
            </div>
          </div>
        )}

        {/* Progress bar - only for non-test and non-challenge games */}
        {!isLocked && maxAttempts !== 1 && !isChallenge && (
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
            disabled={isLocked || isTestCompleted}
            variant={isTestCompleted ? "outline" : isCompleted ? "success" : hasActiveSession ? "warning" : isLocked ? "ghost" : "game"}
            className={`w-full ${isTestCompleted ? "opacity-75" : ""}`}
            size="lg"
          >
            {isLocked ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Complete Previous Games
              </>
            ) : isTestCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Completed
              </>
            ) : hasActiveSession ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Resume Test
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
