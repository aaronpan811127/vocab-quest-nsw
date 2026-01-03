import { Button } from "@/components/ui/button";
import { RotateCcw, Home, RefreshCw } from "lucide-react";

interface GameResultActionsProps {
  onPlayAgain: () => void;
  onTryAgain: () => void;
  onBack: () => void;
  hasMistakes: boolean;
}

export const GameResultActions = ({
  onPlayAgain,
  onTryAgain,
  onBack,
  hasMistakes,
}: GameResultActionsProps) => {
  return (
    <div className="flex flex-col gap-3 pt-4 w-full max-w-sm mx-auto">
      <Button variant="game" onClick={onPlayAgain} size="lg" className="w-full">
        <RotateCcw className="h-4 w-4 mr-2" />
        Play Again
      </Button>
      
      {hasMistakes && (
        <Button variant="outline" onClick={onTryAgain} size="lg" className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Practice Mistakes
        </Button>
      )}
      
      <Button variant="ghost" onClick={onBack} size="sm" className="w-full text-muted-foreground">
        <Home className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
    </div>
  );
};
