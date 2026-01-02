import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Dashboard } from "@/components/Dashboard";
import { ReadingGame } from "@/components/ReadingGame";
import { Leaderboard } from "@/components/Leaderboard";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const [currentView, setCurrentView] = useState<"hero" | "dashboard" | "game" | "leaderboard">("hero");
  const { user } = useAuth();

  const renderContent = () => {
    switch (currentView) {
      case "hero":
        return (
          <Hero 
            onStartPlaying={() => setCurrentView("dashboard")}
            onViewLeaderboard={() => setCurrentView("leaderboard")}
          />
        );
      case "dashboard":
        return <Dashboard onStartGame={(gameType) => setCurrentView("game")} />;
      case "game":
        return (
          <ReadingGame 
            onComplete={() => setCurrentView("dashboard")}
            onBack={() => setCurrentView("dashboard")}
          />
        );
      case "leaderboard":
        return <Leaderboard onBack={() => setCurrentView("hero")} />;
      default:
        return <Hero />;
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      <div className="pt-20">
        {renderContent()}
      </div>
    </div>
  );
};

export default Index;
