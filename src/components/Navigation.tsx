import { Button } from "@/components/ui/button";
import { 
  Home, 
  Trophy, 
  Users, 
  Gamepad2,
  LogOut,
  LogIn,
  Sun,
  Moon
} from "lucide-react";
import { ProfileSettings } from "@/components/ProfileSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

interface NavigationProps {
  currentView: "hero" | "dashboard" | "game" | "leaderboard";
  onViewChange: (view: "hero" | "dashboard" | "game" | "leaderboard") => void;
}

export const Navigation = ({ currentView, onViewChange }: NavigationProps) => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    onViewChange("hero");
  };

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
            {user && (
              <Button
                variant={currentView === "dashboard" ? "default" : "ghost"}
                onClick={() => onViewChange("dashboard")}
                className="gap-2"
              >
                <Trophy className="h-4 w-4" />
                Dashboard
              </Button>
            )}
            <Button 
              variant={currentView === "leaderboard" ? "default" : "ghost"} 
              className="gap-2"
              onClick={() => onViewChange("leaderboard")}
            >
              <Users className="h-4 w-4" />
              Leaderboard
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* User Stats / Auth */}
          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                <ProfileSettings
                  trigger={
                    <button className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        profile.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
                      )}
                    </button>
                  }
                />
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button variant="gaming" onClick={() => navigate("/auth")} className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
