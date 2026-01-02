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
      p-4 space-y-3 border-2 backdrop-blur-sm transition-all duration-300 
      hover:shadow-card hover:scale-105 animate-slide-up
      ${variantClasses[variant]}
    `}>
      <div className="flex items-center justify-between">
        <Icon className={`h-5 w-5 ${iconClasses[variant]}`} />
        <div className="flex items-center gap-1">
          {tooltip && (
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm p-4 z-50" side="top" sideOffset={8}>
                  <div className="text-sm space-y-2 whitespace-pre-line">{tooltip}</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {trend !== "neutral" && (
            <Badge variant="outline" className="text-xs">
              {trend === "up" ? "📈" : "📉"}
            </Badge>
          )}
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {progress && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {progress.label || `${progress.current}/${progress.max} XP to next level`}
          </p>
        </div>
      )}
    </Card>
  );
};