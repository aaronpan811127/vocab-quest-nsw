import { Button } from "@/components/ui/button";
import { Home, Gamepad2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MobileNavProps {
  currentView: "hero" | "dashboard" | "game";
  onViewChange: (view: "hero" | "dashboard" | "game") => void;
}

export const MobileNav = ({ currentView, onViewChange }: MobileNavProps) => {
  const { user } = useAuth();

  const navItems = [
    { view: "hero" as const, icon: Home, label: "Home" },
    ...(user ? [{ view: "dashboard" as const, icon: Gamepad2, label: "Play" }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map(({ view, icon: Icon, label }) => (
          <Button
            key={view}
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(view)}
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              currentView === view ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
};
