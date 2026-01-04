import { Button } from "@/components/ui/button";
import { RotateCcw, Home, RefreshCw } from "lucide-react";

interface GameResultActionsProps {
  onPlayAgain: () => void;
  onPracticeMistakes?: () => void;
  onBack: () => void;
  hasMistakes?: boolean;
}

export const GameResultActions = ({
  onPlayAgain,
  onPracticeMistakes,
  onBack,
  hasMistakes,
}: GameResultActionsProps) => {
  return (
    <div className="flex flex-col gap-3 pt-4 w-full max-w-sm mx-auto">
      <Button type="button" variant="game" onClick={onPlayAgain} size="lg" className="w-full">
        <RotateCcw className="h-4 w-4 mr-2" />
        Play Again
      </Button>
      
      {hasMistakes && onPracticeMistakes && (
        <Button type="button" variant="outline" onClick={onPracticeMistakes} size="lg" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Practice Mistakes
        </Button>
      )}
      
      <Button type="button" variant="ghost" onClick={onBack} size="sm" className="w-full text-muted-foreground">
        <Home className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
    </div>
  );
};
