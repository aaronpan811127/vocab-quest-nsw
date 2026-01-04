import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { MobileNav } from "@/components/MobileNav";
import { Hero } from "@/components/Hero";
import { Dashboard } from "@/components/Dashboard";
import { ReadingGame } from "@/components/ReadingGame";
import { ListeningGame } from "@/components/ListeningGame";
import { VoiceMasterGame } from "@/components/VoiceMasterGame";
import { StoryCreatorGame } from "@/components/StoryCreatorGame";
import { FlashcardGame } from "@/components/FlashcardGame";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { TestType } from "@/contexts/TestTypeContext";

interface GameState {
  unitId: string;
  unitTitle: string;
  gameType: string;
  playAllWordsOnStart?: boolean;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<"hero" | "dashboard" | "game">("hero");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();

  // Load saved unit from profile on mount
  useEffect(() => {
    if (profile?.current_unit_id && !selectedUnitId) {
      setSelectedUnitId(profile.current_unit_id);
    }
  }, [profile?.current_unit_id]);

  // Save unit to database when changed
  const handleUnitChange = async (unitId: string | null) => {
    setSelectedUnitId(unitId);
    if (user && unitId) {
      await updateProfile({ current_unit_id: unitId });
    }
  };

  const handleStartGame = (gameType: string, unitId: string, unitTitle: string, playAllWordsOnStart?: boolean) => {
    setGameState({ unitId, unitTitle, gameType, playAllWordsOnStart });
    setCurrentView("game");
  };

  const handleSelectTestType = (testType: TestType) => {
    setCurrentView("dashboard");
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
        return <ListeningGame {...commonProps} playAllWordsOnStart={gameState.playAllWordsOnStart} />;
      case "speaking":
        return <VoiceMasterGame {...commonProps} playAllWordsOnStart={gameState.playAllWordsOnStart} />;
      case "writing":
        return <StoryCreatorGame {...commonProps} />;
      case "flashcards":
        return <FlashcardGame {...commonProps} />;
      default:
        return <ReadingGame {...commonProps} />;
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case "hero":
        return <Hero onSelectTestType={handleSelectTestType} />;
      case "dashboard":
        return <Dashboard onStartGame={handleStartGame} onBack={() => setCurrentView("hero")} selectedUnitId={selectedUnitId} onUnitChange={handleUnitChange} />;
      case "game":
        return renderGameComponent();
      default:
        return <Hero onSelectTestType={handleSelectTestType} />;
    }
  };

  // Hide bottom nav during game
  const showMobileNav = currentView !== "game";

  return (
    <div className="min-h-screen">
      <Navigation 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      <div className={`pt-16 sm:pt-20 ${showMobileNav ? 'pb-20 md:pb-0' : ''}`}>
        {renderContent()}
      </div>
      {showMobileNav && (
        <MobileNav 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />
      )}
    </div>
  );
};

export default Index;
