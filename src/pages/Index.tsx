import { useState, useEffect, lazy, Suspense } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Navigation } from "@/components/Navigation";
import { MobileNav } from "@/components/MobileNav";
import { Hero } from "@/components/Hero";
import { useAuth } from "@/contexts/AuthContext";

// Lazy-load Dashboard and all game components to reduce initial bundle
const Dashboard = lazy(() => import("@/components/Dashboard").then(m => ({ default: m.Dashboard })));
const ReadingGame = lazy(() => import("@/components/ReadingGame").then(m => ({ default: m.ReadingGame })));
const ListeningGame = lazy(() => import("@/components/ListeningGame").then(m => ({ default: m.ListeningGame })));
const VoiceMasterGame = lazy(() => import("@/components/VoiceMasterGame").then(m => ({ default: m.VoiceMasterGame })));
const StoryCreatorGame = lazy(() => import("@/components/StoryCreatorGame").then(m => ({ default: m.StoryCreatorGame })));
const FlashcardGame = lazy(() => import("@/components/FlashcardGame").then(m => ({ default: m.FlashcardGame })));
const MatchingGame = lazy(() => import("@/components/MatchingGame").then(m => ({ default: m.MatchingGame })));
const OddOneOutGame = lazy(() => import("@/components/OddOneOutGame").then(m => ({ default: m.OddOneOutGame })));
const WordIntuitionGame = lazy(() => import("@/components/WordIntuitionGame").then(m => ({ default: m.WordIntuitionGame })));
const ContextMasterGame = lazy(() => import("@/components/ContextMasterGame").then(m => ({ default: m.ContextMasterGame })));
const ClozeChallengeGame = lazy(() => import("@/components/ClozeChallengeGame").then(m => ({ default: m.ClozeChallengeGame })));
const ClozePassageGame = lazy(() => import("@/components/ClozePassageGame").then(m => ({ default: m.ClozePassageGame })));
const GapFillPassageGame = lazy(() => import("@/components/GapFillPassageGame").then(m => ({ default: m.GapFillPassageGame })));
const WordShooterGame = lazy(() => import("@/components/WordShooterGame").then(m => ({ default: m.WordShooterGame })));
import { useProfile } from "@/hooks/useProfile";
import { useExpiredSessionCheck } from "@/hooks/useExpiredSessionCheck";
import { TestType } from "@/contexts/TestTypeContext";

interface GameState {
  unitId: string;
  unitTitle: string;
  gameType: string;
  unitWords: string[];
  playAllWordsOnStart?: boolean;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<"hero" | "dashboard" | "game">("hero");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  
  // Check for expired test sessions on dashboard load
  useExpiredSessionCheck();

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

  const handleStartGame = (gameType: string, unitId: string, unitTitle: string, unitWords: string[], playAllWordsOnStart?: boolean) => {
    setGameState({ unitId, unitTitle, gameType, unitWords, playAllWordsOnStart });
    setCurrentView("game");
  };

  // Ensure the game header (title + back button) is visible immediately on open.
  useEffect(() => {
    if (currentView === "game") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [currentView, gameState?.unitId, gameState?.gameType]);

  const handleSelectTestType = (testType: TestType) => {
    setCurrentView("dashboard");
  };

  const renderGameComponent = () => {
    if (!gameState) return null;
    
    const commonProps = {
      unitId: gameState.unitId,
      unitTitle: gameState.unitTitle,
      unitWords: gameState.unitWords,
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
        return <StoryCreatorGame {...commonProps} playAllWordsOnStart={gameState.playAllWordsOnStart} />;
      case "flashcards":
        return <FlashcardGame {...commonProps} />;
      case "matching":
        return <MatchingGame {...commonProps} />;
      case "oddoneout":
        return <OddOneOutGame {...commonProps} />;
      case "intuition":
        return <WordIntuitionGame {...commonProps} />;
      case "context_master":
        return <ContextMasterGame {...commonProps} />;
      case "cloze_challenge":
        return <ClozeChallengeGame {...commonProps} />;
      case "linked_extracts":
        return <ClozePassageGame {...commonProps} />;
      case "gap_fill_passage":
        return <GapFillPassageGame {...commonProps} />;
      case "word_shooter":
        return <WordShooterGame {...commonProps} />;
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
    <main className="min-h-screen">
      <SEOHead
        description="The only platform purpose-built for Year 4-6 NSW students to master vocabulary for NSW Selective reading, OC reading, Selective writing, OC writing and NAPLAN placement tests. 10+ gamified vocabulary games with spaced repetition."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "VocabQuests",
            url: "https://vocabquests.com",
            logo: "https://vocabquests.com/og-image.png",
            description: "The only platform purpose-built for NSW students to master vocabulary for Selective School, OC and NAPLAN tests.",
            sameAs: [],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "VocabQuests",
            url: "https://vocabquests.com",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://vocabquests.com/?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            name: "VocabQuests",
            url: "https://vocabquests.com",
            description: "Gamified vocabulary learning platform for NSW Selective, OC & NAPLAN test preparation.",
          },
        ]}
      />
      <Navigation
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      <div className={`pt-16 sm:pt-20 ${showMobileNav ? 'pb-20 md:pb-0' : ''}`}>
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          {renderContent()}
        </Suspense>
      </div>
      {showMobileNav && (
        <MobileNav
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      )}
    </main>
  );
};

export default Index;
