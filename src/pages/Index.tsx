import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Dashboard } from "@/components/Dashboard";
import { ReadingGame } from "@/components/ReadingGame";
import { ListeningGame } from "@/components/ListeningGame";
import { Leaderboard } from "@/components/Leaderboard";
import { useAuth } from "@/contexts/AuthContext";

interface GameState {
  unitId: string;
  unitTitle: string;
  gameType: string;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<"hero" | "dashboard" | "game" | "leaderboard">("hero");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const { user } = useAuth();

  const handleStartGame = (gameType: string, unitId: string, unitTitle: string) => {
    setGameState({ unitId, unitTitle, gameType });
    setCurrentView("game");
  };

  const renderGameComponent = () => {
    if (!gameState) return null;
    
    const commonProps = {
      unitId: gameState.unitId,
      unitTitle: gameState.unitTitle,
      onComplete: () => setCurrentView("dashboard"),
      onBack: () => setCurrentView("dashboard"),
    };

    switch (gameState.gameType) {
      case "reading":
        return <ReadingGame {...commonProps} />;
      case "listening":
        return <ListeningGame {...commonProps} />;
      default:
        return <ReadingGame {...commonProps} />;
    }
  };

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
        return <Dashboard onStartGame={handleStartGame} />;
      case "game":
        return renderGameComponent();
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
