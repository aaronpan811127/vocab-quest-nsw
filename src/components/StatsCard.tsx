import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LucideIcon, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "success" | "warning";
  trend?: "up" | "down" | "neutral";
  tooltip?: string;
  progress?: {
    current: number;
    max: number;
    label?: string;
  };
  action?: ReactNode;
}

export const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "primary",
  trend = "neutral",
  tooltip,
  progress,
  action,
}: StatsCardProps) => {
  const variantClasses = {
    primary: "border-primary/20 bg-primary/5",
    secondary: "border-secondary/20 bg-secondary/5",
    success: "border-success/20 bg-success/5",
    warning: "border-warning/20 bg-warning/5",
  };

  const iconClasses = {
    primary: "text-primary",
    secondary: "text-secondary", 
    success: "text-success",
    warning: "text-warning",
  };

  const progressPercent = progress ? (progress.current / progress.max) * 100 : 0;

  return (
    <Card className={`
      p-3 space-y-2 border backdrop-blur-sm transition-all duration-300 
      hover:shadow-card hover:scale-[1.02] animate-slide-up
      ${variantClasses[variant]}
    `}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <div className="flex items-center gap-2">
          {action}
          {tooltip && (
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm p-3 z-50" side="top" sideOffset={8}>
                  <div className="text-sm space-y-2 whitespace-pre-line">{tooltip}</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      <div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
      </div>

      {progress && (
        <div className="space-y-0.5">
          <Progress value={progressPercent} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">
            {progress.label || `${progress.current}/${progress.max} XP to next level`}
          </p>
        </div>
      )}
    </Card>
  );
};