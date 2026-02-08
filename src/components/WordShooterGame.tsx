import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Crosshair,
  Zap,
  RotateCcw,
  Clock,
  Target,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCelebration } from "@/hooks/useCelebration";

interface Word {
  id: string;
  word: string;
  definition: string;
  synonyms: string[];
  antonyms: string[];
}

interface Round {
  targetWord: string;
  questionType: "synonym" | "antonym";
  correctAnswer: string;
  options: string[];
}

interface RoundResult {
  word: string;
  isCorrect: boolean;
  userAnswer: string | null;
  questionType: "synonym" | "antonym";
}

interface WordShooterGameProps {
  unitId: string;
  unitTitle: string;
  unitWords: string[];
  gameId?: string;
  onComplete: () => void;
  onBack: () => void;
}

const WORD_SHOOTER_GAME_ID = "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b";
const FLIP_DURATION_MS = 2000;

export const WordShooterGame = ({
  unitId,
  unitTitle,
  unitWords,
  gameId,
  onComplete,
  onBack,
}: WordShooterGameProps) => {
  const [words, setWords] = useState<Word[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [startTime] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [resolvedGameId, setResolvedGameId] = useState<string | null>(
    gameId || WORD_SHOOTER_GAME_ID
  );

  // Round-level state
  const [cardsVisible, setCardsVisible] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [roundLocked, setRoundLocked] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [countdown, setCountdown] = useState(FLIP_DURATION_MS / 1000);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { celebrate } = useCelebration();
  const hasCelebrated = useRef(false);

  // Resolve game ID
  useEffect(() => {
    const resolveGameId = async () => {
      if (!gameId) {
        const { data } = await supabase
          .from("games")
          .select("id")
          .eq("game_type", "word_shooter")
          .single();
        if (data) setResolvedGameId(data.id);
      }
    };
    resolveGameId();
  }, [gameId]);

  // Load vocabulary
  useEffect(() => {
    fetchVocabularyAndBuildRounds();
  }, [unitId]);

  // Celebration effect
  useEffect(() => {
    if (showCompletion && !hasCelebrated.current) {
      hasCelebrated.current = true;
      celebrate({
        score: correctAnswers,
        totalQuestions: rounds.length,
        gameName: "Word Shooter",
      });
      setTimeout(() => setShowXpAnimation(true), 300);
    }
  }, [showCompletion, correctAnswers, rounds.length, celebrate]);

  const fetchVocabularyAndBuildRounds = async () => {
    setLoading(true);
    try {
      let { data: vocabData, error } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("unit_id", unitId);

      if (error) throw error;

      if (!vocabData || vocabData.length < 4) {
        if (!unitWords || unitWords.length < 4) {
          toast({
            title: "Not enough words",
            description: "This unit needs at least 4 words to play.",
            variant: "destructive",
          });
          return;
        }

        setGenerating(true);
        toast({
          title: "Generating vocabulary...",
          description: "Creating definitions and synonyms for words.",
        });

        const { data: genData, error: genError } =
          await supabase.functions.invoke("generate-vocabulary", {
            body: { unit_id: unitId, words: unitWords },
          });

        if (genError) throw new Error("Failed to generate vocabulary");

        if (genData?.success) {
          const { data: freshData, error: freshError } = await supabase
            .from("vocabulary")
            .select("*")
            .eq("unit_id", unitId);
          if (freshError) throw freshError;
          vocabData = freshData;
        } else {
          throw new Error(genData?.error || "Failed to generate vocabulary");
        }
      }

      if (!vocabData || vocabData.length < 4) {
        toast({
          title: "Vocabulary generation failed",
          description:
            "Please try playing Flashcards first to generate vocabulary.",
          variant: "destructive",
        });
        return;
      }

      setWords(vocabData as Word[]);
      buildRounds(vocabData as Word[]);
    } catch (err) {
      console.error("Error fetching vocabulary:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to load vocabulary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const buildRounds = (vocabWords: Word[]) => {
    const gameRounds: Round[] = [];
    const shuffledWords = [...vocabWords].sort(() => Math.random() - 0.5);

    // Build one round per word (up to 10)
    for (const word of shuffledWords.slice(0, 10)) {
      const hasSynonyms = word.synonyms && word.synonyms.length > 0;
      const hasAntonyms = word.antonyms && word.antonyms.length > 0;

      if (!hasSynonyms && !hasAntonyms) continue;

      // Pick type randomly if both available
      const questionType: "synonym" | "antonym" =
        hasSynonyms && hasAntonyms
          ? Math.random() > 0.5
            ? "synonym"
            : "antonym"
          : hasSynonyms
          ? "synonym"
          : "antonym";

      const pool =
        questionType === "synonym" ? word.synonyms : word.antonyms;
      const correctAnswer = pool[Math.floor(Math.random() * pool.length)];

      // Build distractors from other words' synonyms/antonyms
      const distractors: string[] = [];
      const allOtherWords = vocabWords.filter((w) => w.id !== word.id);
      const shuffledOthers = [...allOtherWords].sort(
        () => Math.random() - 0.5
      );

      for (const other of shuffledOthers) {
        if (distractors.length >= 3) break;
        // Pick from the opposite pool or general pool
        const candidates = [
          ...(other.synonyms || []),
          ...(other.antonyms || []),
          other.word,
        ];
        for (const c of candidates) {
          if (
            distractors.length >= 3 ||
            c.toLowerCase() === correctAnswer.toLowerCase() ||
            c.toLowerCase() === word.word.toLowerCase() ||
            distractors.some((d) => d.toLowerCase() === c.toLowerCase())
          )
            continue;
          distractors.push(c);
        }
      }

      // Fallback if not enough distractors
      while (distractors.length < 3) {
        const fallback = allOtherWords[distractors.length % allOtherWords.length];
        if (
          fallback &&
          !distractors.includes(fallback.word) &&
          fallback.word.toLowerCase() !== correctAnswer.toLowerCase()
        ) {
          distractors.push(fallback.word);
        } else {
          break;
        }
      }

      if (distractors.length < 3) continue;

      const options = [correctAnswer, ...distractors.slice(0, 3)].sort(
        () => Math.random() - 0.5
      );

      gameRounds.push({
        targetWord: word.word,
        questionType,
        correctAnswer,
        options,
      });
    }

    setRounds(gameRounds);
  };

  // Start the flip timer for current round
  const startFlipTimer = useCallback(() => {
    setCardsVisible(true);
    setSelectedAnswer(null);
    setRoundLocked(false);
    setTimeExpired(false);
    setCountdown(FLIP_DURATION_MS / 1000);

    // Countdown interval
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0.1) return 0;
        return +(prev - 0.1).toFixed(1);
      });
    }, 100);

    // Flip timer
    flipTimerRef.current = setTimeout(() => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setTimeExpired(true);
      setRoundLocked(true);
      setCountdown(0);
    }, FLIP_DURATION_MS);
  }, []);

  // Start timer when round changes
  useEffect(() => {
    if (rounds.length > 0 && currentRound < rounds.length && !showCompletion) {
      // Small delay to let the UI update before showing cards
      const delay = setTimeout(() => startFlipTimer(), 400);
      return () => {
        clearTimeout(delay);
        if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [currentRound, rounds.length, showCompletion, startFlipTimer]);

  const handleSelectAnswer = (answer: string) => {
    if (roundLocked || selectedAnswer) return;

    // Clear timers
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setSelectedAnswer(answer);
    setRoundLocked(true);

    const currentR = rounds[currentRound];
    const isCorrect = answer === currentR.correctAnswer;

    if (isCorrect) {
      setCorrectAnswers((prev) => prev + 1);
    }

    setRoundResults((prev) => [
      ...prev,
      {
        word: currentR.targetWord,
        isCorrect,
        userAnswer: answer,
        questionType: currentR.questionType,
      },
    ]);
  };

  // Handle timeout (no selection)
  useEffect(() => {
    if (timeExpired && !selectedAnswer && rounds.length > 0 && currentRound < rounds.length) {
      const currentR = rounds[currentRound];
      setRoundResults((prev) => [
        ...prev,
        {
          word: currentR.targetWord,
          isCorrect: false,
          userAnswer: null,
          questionType: currentR.questionType,
        },
      ]);
    }
  }, [timeExpired, selectedAnswer]);

  const handleNext = async () => {
    if (currentRound < rounds.length - 1) {
      setCurrentRound((prev) => prev + 1);
    } else {
      setSaving(true);
      await saveGameAttempt();
      setShowCompletion(true);
    }
  };

  const saveGameAttempt = async () => {
    if (!user || !resolvedGameId) return;

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const score = Math.round((correctAnswers / rounds.length) * 100);
    const isPerfect = correctAnswers === rounds.length;

    try {
      const { error } = await supabase.from("game_attempts").insert({
        user_id: user.id,
        unit_id: unitId,
        game_id: resolvedGameId,
        score,
        correct_answers: correctAnswers,
        total_questions: rounds.length,
        time_spent_seconds: timeSpent,
        completed: true,
      });

      if (error) throw error;

      // Save/update user_progress
      const { data: existingProgress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("unit_id", unitId)
        .eq("game_id", resolvedGameId)
        .maybeSingle();

      const previousXp = existingProgress?.total_xp || 0;

      if (existingProgress) {
        await supabase
          .from("user_progress")
          .update({
            completed: existingProgress.completed || isPerfect,
            attempts: (existingProgress.attempts || 0) + 1,
            total_time_seconds:
              (existingProgress.total_time_seconds || 0) + timeSpent,
            best_score: Math.max(existingProgress.best_score || 0, score),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProgress.id);
      } else {
        await supabase.from("user_progress").insert({
          user_id: user.id,
          unit_id: unitId,
          game_id: resolvedGameId,
          completed: isPerfect,
          attempts: 1,
          total_time_seconds: timeSpent,
          best_score: score,
        });
      }

      // Read back updated XP
      const { data: updatedProgress } = await supabase
        .from("user_progress")
        .select("total_xp")
        .eq("user_id", user.id)
        .eq("unit_id", unitId)
        .eq("game_id", resolvedGameId)
        .maybeSingle();

      const newXp = updatedProgress?.total_xp || 0;
      setEarnedXp(Math.max(0, newXp - previousXp));
    } catch (err) {
      console.error("Error saving game attempt:", err);
    } finally {
      setSaving(false);
    }
  };

  const resetGame = () => {
    setCurrentRound(0);
    setRoundResults([]);
    setCorrectAnswers(0);
    setSelectedAnswer(null);
    setRoundLocked(false);
    setTimeExpired(false);
    setShowCompletion(false);
    setShowXpAnimation(false);
    setEarnedXp(0);
    hasCelebrated.current = false;
    buildRounds(words);
  };

  // --- Render ---

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">
              {generating ? "Generating vocabulary..." : "Loading game..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <Crosshair className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Not enough vocabulary</h2>
            <p className="text-muted-foreground">
              This unit needs more words with synonyms or antonyms to play.
            </p>
            <Button variant="outline" onClick={onBack} size="lg">
              Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Completion screen
  if (showCompletion) {
    const isPerfect = correctAnswers === rounds.length;

    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-primary">
              {isPerfect ? "Perfect Score!" : "Game Complete!"}
            </h2>
            <p className="text-lg text-muted-foreground">
              You got {correctAnswers} out of {rounds.length} correct in{" "}
              {unitTitle}!
            </p>
            <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-lg px-6 py-2">
              {correctAnswers} / {rounds.length} Complete
            </Badge>

            {/* Results breakdown */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {roundResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    r.isCorrect
                      ? "bg-success/10 border border-success/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.isCorrect ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-medium">{r.word}</span>
                    <span className="text-xs text-muted-foreground">
                      ({r.questionType})
                    </span>
                  </div>
                  {!r.isCorrect && (
                    <span className="text-sm text-muted-foreground">
                      {r.userAnswer
                        ? `You picked: "${r.userAnswer}"`
                        : "Time's up!"}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* XP Animation */}
            <div
              className={`
                flex items-center justify-center gap-2 py-3 px-6 rounded-full 
                bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30
                transition-all duration-500 ease-out
                ${
                  showXpAnimation
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-4 scale-95"
                }
              `}
            >
              <Zap
                className={`h-6 w-6 text-primary ${
                  showXpAnimation ? "animate-pulse" : ""
                }`}
              />
              <span className="text-xl font-bold text-primary">
                +{earnedXp} XP
              </span>
              {saving && (
                <span className="text-sm text-muted-foreground">
                  (saving...)
                </span>
              )}
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={resetGame} size="lg">
                <RotateCcw className="h-5 w-5 mr-2" />
                Play Again
              </Button>
              <Button variant="hero" onClick={onComplete} size="lg">
                <Check className="h-5 w-5 mr-2" />
                Complete
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Active game round
  const currentR = rounds[currentRound];
  const timerPercentage = (countdown / (FLIP_DURATION_MS / 1000)) * 100;
  const isUrgent = countdown <= 0.5;
  const isWarning = countdown <= 1 && !isUrgent;

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header with animated crosshair */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Crosshair className={`h-7 w-7 text-primary ${!roundLocked ? 'animate-crosshair-spin' : 'animate-crosshair-lock'}`} />
              {!roundLocked && cardsVisible && (
                <div className="absolute inset-0 rounded-full animate-target-pulse" />
              )}
            </div>
            <h1 className="text-lg sm:text-2xl font-bold">Word Shooter</h1>
            <Badge className="bg-gradient-primary text-primary-foreground hidden sm:inline-flex">
              {unitTitle}
            </Badge>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" />
              Round {currentRound + 1} of {rounds.length}
            </span>
            <span className="flex items-center gap-1.5">
              <CircleDot className="h-3.5 w-3.5 text-success" />
              {correctAnswers} hits
            </span>
          </div>
          <Progress
            value={((currentRound + 1) / rounds.length) * 100}
            className="h-2"
          />
        </div>

        {/* Main game card */}
        <Card className="relative overflow-hidden p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          {/* Scope scan overlay */}
          {!roundLocked && cardsVisible && (
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, hsl(var(--primary)) 20px, hsl(var(--primary)) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, hsl(var(--primary)) 20px, hsl(var(--primary)) 21px)`,
              }}
            />
          )}

          {/* Target word with crosshair decoration */}
          <div className="text-center mb-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Crosshair className="h-4 w-4" />
              <span>
                Find the <span className="font-bold text-primary">{currentR.questionType}</span>
              </span>
              <Crosshair className="h-4 w-4" />
            </div>
            <div className="relative inline-block">
              <div className={`absolute -inset-4 rounded-full border-2 border-dashed border-primary/20 ${!roundLocked ? 'animate-crosshair-spin' : ''}`} style={{ animationDuration: '8s' }} />
              <div className={`absolute -inset-8 rounded-full border border-dashed border-primary/10 ${!roundLocked ? 'animate-crosshair-spin' : ''}`} style={{ animationDuration: '12s', animationDirection: 'reverse' }} />
              <div className={`inline-block px-8 py-4 rounded-xl bg-primary/10 border-2 border-primary/30 ${!roundLocked ? 'animate-target-pulse' : ''}`}>
                <span className="text-2xl sm:text-3xl font-bold text-primary">
                  {currentR.targetWord}
                </span>
              </div>
            </div>
          </div>

          {/* Circular timer */}
          <div className="flex items-center justify-center mb-5">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke={isUrgent ? 'hsl(var(--destructive))' : isWarning ? 'hsl(var(--warning))' : 'hsl(var(--primary))'}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - timerPercentage / 100)}`}
                  className="transition-all duration-100"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${isUrgent ? 'text-destructive animate-pulse' : isWarning ? 'text-warning' : 'text-primary'}`}>
                  {countdown.toFixed(1)}
                </span>
              </div>
              {isUrgent && !roundLocked && (
                <div className="absolute inset-0 rounded-full border-2 border-destructive animate-impact-ring" />
              )}
            </div>
          </div>

          {/* Shooting gallery – moving word targets */}
          <ShootingGallery
            key={`round-${currentRound}`}
            options={currentR.options}
            correctAnswer={currentR.correctAnswer}
            selectedAnswer={selectedAnswer}
            roundLocked={roundLocked}
            cardsVisible={cardsVisible}
            timeExpired={timeExpired}
            onSelect={handleSelectAnswer}
          />

          {/* Feedback after selection or timeout */}
          {roundLocked && (
            <div className={`mt-6 p-4 rounded-lg space-y-2 animate-slide-up ${
              selectedAnswer === currentR.correctAnswer
                ? 'bg-success/10 border border-success/30'
                : 'bg-destructive/10 border border-destructive/30'
            }`}>
              {selectedAnswer === currentR.correctAnswer ? (
                <p className="font-medium text-success flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Direct hit! <span className="text-foreground">"{currentR.correctAnswer}"</span> is a {currentR.questionType} of "{currentR.targetWord}".
                </p>
              ) : timeExpired && !selectedAnswer ? (
                <p className="font-medium text-destructive flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time's up! The target was <span className="text-foreground">"{currentR.correctAnswer}"</span>.
                </p>
              ) : (
                <p className="font-medium text-destructive flex items-center gap-2">
                  <X className="h-5 w-5" />
                  Missed! The target was <span className="text-foreground">"{currentR.correctAnswer}"</span>.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Next button */}
        {roundLocked && (
          <div className="flex justify-center animate-slide-up">
            <Button variant="hero" onClick={handleNext} size="lg" className="min-w-[150px] gap-2">
              <Crosshair className="h-4 w-4" />
              {currentRound < rounds.length - 1 ? "Next Target" : "See Results"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================
   ShootingGallery – word cards that drift randomly in a container
   ================================================================ */

interface ShootingGalleryProps {
  options: string[];
  correctAnswer: string;
  selectedAnswer: string | null;
  roundLocked: boolean;
  cardsVisible: boolean;
  timeExpired: boolean;
  onSelect: (answer: string) => void;
}

interface CardPosition {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const GALLERY_HEIGHT = 260;
const CARD_W = 140;
const CARD_H = 52;
const SPEED = 0.8;

function randomStartPositions(count: number, containerWidth: number): CardPosition[] {
  const positions: CardPosition[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * Math.max(0, containerWidth - CARD_W);
    const y = Math.random() * Math.max(0, GALLERY_HEIGHT - CARD_H);
    const angle = Math.random() * Math.PI * 2;
    positions.push({
      x,
      y,
      dx: Math.cos(angle) * SPEED * (0.7 + Math.random() * 0.6),
      dy: Math.sin(angle) * SPEED * (0.7 + Math.random() * 0.6),
    });
  }
  return positions;
}

const ShootingGallery = ({
  options,
  correctAnswer,
  selectedAnswer,
  roundLocked,
  cardsVisible,
  timeExpired,
  onSelect,
}: ShootingGalleryProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<CardPosition[]>([]);
  const animRef = useRef<number>(0);
  const posRef = useRef<CardPosition[]>([]);

  // Initialise positions once container mounts
  useEffect(() => {
    const w = containerRef.current?.clientWidth || 400;
    const initial = randomStartPositions(options.length, w);
    posRef.current = initial;
    setPositions([...initial]);
  }, [options.length]);

  // Animate cards while visible and not locked
  useEffect(() => {
    if (!cardsVisible || roundLocked) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const containerW = containerRef.current?.clientWidth || 400;

    const tick = () => {
      const next = posRef.current.map((p) => {
        let { x, y, dx, dy } = p;
        x += dx;
        y += dy;
        if (x <= 0) { x = 0; dx = Math.abs(dx); }
        if (x >= containerW - CARD_W) { x = containerW - CARD_W; dx = -Math.abs(dx); }
        if (y <= 0) { y = 0; dy = Math.abs(dy); }
        if (y >= GALLERY_HEIGHT - CARD_H) { y = GALLERY_HEIGHT - CARD_H; dy = -Math.abs(dy); }
        return { x, y, dx, dy };
      });
      posRef.current = next;
      setPositions([...next]);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [cardsVisible, roundLocked]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl bg-muted/20 border border-border/30 overflow-hidden"
      style={{ height: GALLERY_HEIGHT }}
    >
      {/* Crosshair reticle in centre */}
      {!roundLocked && cardsVisible && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
          <Crosshair className="h-24 w-24 text-primary" />
        </div>
      )}

      {options.map((option, index) => {
        const pos = positions[index];
        if (!pos) return null;

        const isSelected = selectedAnswer === option;
        const isCorrect = option === correctAnswer;
        const showCorrectHighlight = roundLocked && isCorrect;
        const showWrongHighlight = roundLocked && isSelected && !isCorrect;
        const isTimedOut = timeExpired && !selectedAnswer;

        return (
          <button
            key={`${option}-${index}`}
            onClick={() => onSelect(option)}
            disabled={roundLocked || !cardsVisible}
            className={`
              absolute flex items-center justify-center gap-1.5
              px-4 py-2.5 text-sm sm:text-base font-semibold rounded-xl
              border-2 shadow-md select-none
              transition-colors duration-200
              ${showWrongHighlight ? 'animate-shake' : ''}
              ${
                !cardsVisible
                  ? "opacity-0 scale-75"
                  : showCorrectHighlight
                  ? "bg-success/20 border-success text-success scale-110 shadow-lg z-20"
                  : showWrongHighlight
                  ? "bg-destructive/20 border-destructive text-destructive z-20"
                  : isTimedOut && isCorrect
                  ? "bg-success/20 border-success text-success z-20"
                  : isTimedOut
                  ? "bg-muted/50 border-border/50 opacity-60"
                  : "bg-card border-border/50 hover:border-primary hover:bg-primary/10 hover:shadow-glow cursor-pointer active:scale-90 z-10"
              }
            `}
            style={{
              left: pos.x,
              top: pos.y,
              width: CARD_W,
              height: CARD_H,
            }}
          >
            {showCorrectHighlight && (
              <>
                <div className="absolute inset-0 rounded-xl border-2 border-success animate-impact-ring" />
                <div className="absolute inset-0 rounded-xl border-2 border-success animate-impact-ring" style={{ animationDelay: '0.15s' }} />
              </>
            )}
            <span className="relative z-10 flex items-center gap-1.5 truncate">
              {showCorrectHighlight && <Target className="h-4 w-4 text-success shrink-0" />}
              {showWrongHighlight && <X className="h-4 w-4 text-destructive shrink-0" />}
              {cardsVisible ? option : "?"}
            </span>
          </button>
        );
      })}
    </div>
  );
};
