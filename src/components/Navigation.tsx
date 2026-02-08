import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard, Gamepad2, LogOut, LogIn, Sun, Moon, HelpCircle, Menu, CreditCard, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useTestType } from "@/contexts/TestTypeContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Lazy-load ProfileSettings since it's only shown on user click
const ProfileSettings = lazy(() => import("@/components/ProfileSettings").then(m => ({ default: m.ProfileSettings })));

interface NavigationProps {
  currentView?: "hero" | "dashboard" | "game";
  onViewChange?: (view: "hero" | "dashboard" | "game") => void;
}

export const Navigation = ({
  currentView = "hero",
  onViewChange
}: NavigationProps) => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { selectedTestType } = useTestType();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    if (onViewChange) {
      onViewChange("hero");
    } else {
      navigate("/");
    }
    setMobileMenuOpen(false);
  };

  const handleNavigation = (view: "hero" | "dashboard" | "game") => {
    if (onViewChange) {
      onViewChange(view);
    } else {
      // Navigate to home page for standalone pages
      navigate("/");
    }
    setMobileMenuOpen(false);
  };

  const handleNavigateTo = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
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
            <Button variant="ghost" onClick={() => navigate("/how-it-works")} className="gap-2">
              <HelpCircle className="h-4 w-4" />
              How It Works
            </Button>
            <Button variant="ghost" onClick={() => navigate("/pricing")} className="gap-2">
              <CreditCard className="h-4 w-4" />
              Pricing
            </Button>
            <Button variant="ghost" onClick={() => navigate("/contact")} className="gap-2">
              <Mail className="h-4 w-4" />
              Contact
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          {/* User Stats / Auth */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    VocabQuest
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  <Button 
                    variant={currentView === "hero" ? "default" : "ghost"} 
                    onClick={() => handleNavigation("hero")} 
                    className="justify-start gap-3 h-12"
                  >
                    <Home className="h-5 w-5" />
                    Home
                  </Button>
                  {user && selectedTestType && (
                    <Button 
                      variant={currentView === "dashboard" ? "default" : "ghost"} 
                      onClick={() => handleNavigation("dashboard")} 
                      className="justify-start gap-3 h-12"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      Dashboard
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    onClick={() => handleNavigateTo("/how-it-works")} 
                    className="justify-start gap-3 h-12"
                  >
                    <HelpCircle className="h-5 w-5" />
                    How It Works
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleNavigateTo("/pricing")} 
                    className="justify-start gap-3 h-12"
                  >
                    <CreditCard className="h-5 w-5" />
                    Pricing
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleNavigateTo("/contact")} 
                    className="justify-start gap-3 h-12"
                  >
                    <Mail className="h-5 w-5" />
                    Contact
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
                    className="justify-start gap-3 h-12"
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </Button>
                  
                  <div className="border-t border-border my-4" />
                  
                  {user ? (
                    <Button 
                      variant="ghost" 
                      onClick={handleSignOut} 
                      className="justify-start gap-3 h-12 text-destructive hover:text-destructive"
                    >
                      <LogOut className="h-5 w-5" />
                      Sign Out
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="default" 
                        onClick={() => handleNavigateTo("/auth")} 
                        className="justify-start gap-3 h-12"
                      >
                        <Gamepad2 className="h-5 w-5" />
                        Student Sign In
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleNavigateTo("/parent-auth")} 
                        className="justify-start gap-3 h-12"
                      >
                        <LogIn className="h-5 w-5" />
                        Parent Sign In
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            
            {user && profile ? (
              <>
                <Suspense fallback={
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {profile.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                }>
                  <ProfileSettings trigger={
                    <button className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        profile.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
                      )}
                    </button>
                  } />
                </Suspense>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="hidden md:flex h-8 w-8 sm:h-9 sm:w-9">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="gaming" onClick={() => navigate("/auth")} className="gap-2 text-sm sm:text-base px-3 sm:px-4">
                  <LogIn className="h-4 w-4" />
                  <span>Student</span>
                </Button>
                <Button variant="outline" onClick={() => navigate("/parent-auth")} className="gap-2 text-sm sm:text-base px-3 sm:px-4">
                  <LogIn className="h-4 w-4" />
                  <span>Parent</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};