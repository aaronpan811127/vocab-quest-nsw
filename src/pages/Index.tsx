import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Dashboard } from "@/components/Dashboard";
import { ReadingGame } from "@/components/ReadingGame";

const Index = () => {
  const [currentView, setCurrentView] = useState<"hero" | "dashboard" | "game">("hero");

  const renderContent = () => {
    switch (currentView) {
      case "hero":
        return (
          <Hero 
            onStartPlaying={() => setCurrentView("dashboard")}
            onViewLeaderboard={() => setCurrentView("dashboard")}
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
