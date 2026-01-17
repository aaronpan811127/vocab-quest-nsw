import { Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface GameTimerProps {
  formattedTime: string;
  percentage: number;
  timerColor: string;
  progressColor: string;
  isExpired: boolean;
}

export const GameTimer = ({
  formattedTime,
  percentage,
  timerColor,
  progressColor,
  isExpired
}: GameTimerProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-2 font-mono text-lg font-bold", timerColor)}>
          <Clock className={cn("h-5 w-5", isExpired && "animate-pulse")} />
          <span>{formattedTime}</span>
        </div>
        {isExpired && (
          <span className="text-destructive text-sm font-medium animate-pulse">
            Time's up!
          </span>
        )}
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear rounded-full",
            progressColor
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
