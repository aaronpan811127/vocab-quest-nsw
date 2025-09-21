import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Trophy, 
  Users, 
  Settings,
  Gamepad2,
  Crown
} from "lucide-react";

interface NavigationProps {
  currentView: "hero" | "dashboard" | "game";
  onViewChange: (view: "hero" | "dashboard" | "game") => void;
}

export const Navigation = ({ currentView, onViewChange }: NavigationProps) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <Gamepad2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">VocabQuest</h1>
              <p className="text-xs text-muted-foreground">NSW Selective Prep</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant={currentView === "hero" ? "default" : "ghost"}
              onClick={() => onViewChange("hero")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
            <Button
              variant={currentView === "dashboard" ? "default" : "ghost"}
              onClick={() => onViewChange("dashboard")}
              className="gap-2"
            >
              <Trophy className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="ghost" className="gap-2">
              <Users className="h-4 w-4" />
              Leaderboard
            </Button>
            <Button variant="ghost" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>

          {/* User Stats */}
          <div className="flex items-center gap-3">
            <Badge className="bg-gradient-success text-success-foreground hidden sm:flex">
              <Crown className="h-3 w-3 mr-1" />
              Level 12
            </Badge>
            <Badge variant="outline" className="hidden sm:flex">
              2,450 XP
            </Badge>
            <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              A
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};