import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard, Gamepad2, LogOut, LogIn, Sun, Moon } from "lucide-react";
import { ProfileSettings } from "@/components/ProfileSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useTestType } from "@/contexts/TestTypeContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";

interface NavigationProps {
  currentView: "hero" | "dashboard" | "game";
  onViewChange: (view: "hero" | "dashboard" | "game") => void;
}

export const Navigation = ({
  currentView,
  onViewChange
}: NavigationProps) => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { selectedTestType } = useTestType();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    onViewChange("hero");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-primary">
              <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <h1 className="font-bold text-lg sm:text-2xl">VocabQuest</h1>
            {selectedTestType && currentView === "dashboard" && (
              <Badge variant="outline" className="hidden sm:flex bg-primary/10 text-primary border-primary/30">
                {selectedTestType.name}
              </Badge>
            )}
          </div>

          {/* Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant={currentView === "hero" ? "default" : "ghost"} onClick={() => onViewChange("hero")} className="gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
            {user && selectedTestType && (
              <Button variant={currentView === "dashboard" ? "default" : "ghost"} onClick={() => onViewChange("dashboard")} className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          {/* User Stats / Auth */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme toggle for mobile */}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="md:hidden h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            {user && profile ? (
              <>
                <ProfileSettings trigger={
                  <button className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
                    )}
                  </button>
                } />
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 sm:h-9 sm:w-9">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="gaming" onClick={() => navigate("/auth")} className="gap-2 text-sm sm:text-base px-3 sm:px-4">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Student</span>
                </Button>
                <Button variant="outline" onClick={() => navigate("/parent-auth")} className="gap-2 text-sm sm:text-base px-3 sm:px-4">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Parent</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};