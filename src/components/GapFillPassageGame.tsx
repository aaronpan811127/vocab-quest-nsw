import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { useToast } from "@/hooks/use-toast";
import { useCelebration } from "@/hooks/useCelebration";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useTestSession } from "@/hooks/useTestSession";
import { GameTimer } from "@/components/GameTimer";

interface Option {
  label: string;
  text: string;
}

interface GapFillPassageGameProps {
  unitId: string;
  unitTitle: string;
  unitWords: string[];
  onComplete: () => void;
  onBack: () => void;
}

const DEFAULT_SECONDS_PER_QUESTION = 150; // 2.5 min per gap for 8 gaps = 20 min total

export const GapFillPassageGame = ({ unitId, unitTitle, unitWords, onComplete, onBack }: GapFillPassageGameProps) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [passage, setPassage] = useState<string>("");
  const [passageTitle, setPassageTitle] = useState<string>("");
  const [options, setOptions] = useState<Option[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, string>>({});
  const [passageId, setPassageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverScore, setServerScore] = useState(0);
  const [serverCorrectCount, setServerCorrectCount] = useState(0);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(DEFAULT_SECONDS_PER_QUESTION);
  const [timerActive, setTimerActive] = useState(false);
  const [initialTimeRemaining, setInitialTimeRemaining] = useState<number | undefined>(undefined);
  const [gameId, setGameId] = useState<string | null>(null);
  const [numGaps, setNumGaps] = useState(8);
  const { user } = useAuth();
  const { selectedTestType } = useTestType();
  const { toast } = useToast();
  const { celebrate } = useCelebration();
  const { 
    session, 
    alreadyCompleted, 
    previousScore, 
    startSession,
    saveProgress,
    isLoading: sessionLoading 
  } = useTestSession();
  const startTimeRef = useRef<number>(Date.now());
  const hasCelebrated = useRef(false);
  const isSubmittingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const questionIdsRef = useRef<string[]>([]);

  // Timer time-up handler
  const handleTimeUp = useCallback(async () => {
    if (isSubmittingRef.current || showResults) return;
    isSubmittingRef.current = true;
    setTimerActive(false);
    setSaving(true);
    
    toast({
      title: "Time's Up!",
      description: "Your test is being submitted automatically.",
      variant: "destructive"
    });
    
    await submitTestInternal();
    setShowResults(true);
  }, [showResults, toast]);

  const timer = useGameTimer({
    totalQuestions: numGaps,
    secondsPerQuestion,
    onTimeUp: handleTimeUp,
    isActive: timerActive && !showResults && !loading && numGaps > 0,
    initialTimeRemaining
  });

  useEffect(() => {
    loadGame();
  }, [unitId]);

  // Trigger celebration when showing results
  useEffect(() => {
    if (showResults && !hasCelebrated.current) {
      hasCelebrated.current = true;
      celebrate({
        score: serverCorrectCount,
        totalQuestions: numGaps,
        gameName: 'Gap Fill Passage'
      });
    }
  }, [showResults, serverCorrectCount, numGaps, celebrate]);

  const loadGame = async () => {
    setLoading(true);
    setError(null);
    setTimerActive(false);
    
    try {
      if (!user) {
        setError("Please log in to take this test.");
        setLoading(false);
        return;
      }

      // Get the game ID for gap_fill_passage
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, rules")
        .eq("game_type", "gap_fill_passage")
        .single();

      if (gameError || !gameData) {
        console.error("Error fetching game:", gameError);
        setError("Gap Fill Passage game not configured.");
        setLoading(false);
        return;
      }

      setGameId(gameData.id);
      const rules = gameData.rules as Record<string, unknown> | null;
      const configuredSecondsPerQuestion = (rules?.time_limit_minutes as number) 
        ? ((rules.time_limit_minutes as number) * 60) / ((rules?.questions_per_passage as number) || 8)
        : DEFAULT_SECONDS_PER_QUESTION;
      setSecondsPerQuestion(configuredSecondsPerQuestion);
      const configuredGaps = (rules?.questions_per_passage as number) || 8;
      setNumGaps(configuredGaps);

      // Check if user has already completed this game for this unit
      const { data: existingAttempt } = await supabase
        .from("game_attempts")
        .select("id, score")
        .eq("user_id", user.id)
        .eq("unit_id", unitId)
        .eq("game_id", gameData.id)
        .eq("completed", true)
        .maybeSingle();

      if (existingAttempt) {
        setServerScore(existingAttempt.score);
        setShowResults(true);
        setLoading(false);
        return;
      }

      // Check for existing passage for this unit
      const { data: existingPassages, error: passageError } = await supabase
        .from("reading_passages")
        .select("id, title, content")
        .eq("unit_id", unitId)
        .eq("is_generated", true)
        .ilike("title", "Gap Fill Passage:%")
        .or("review_status.is.null,review_status.neq.rejected")
        .limit(1);

      let passageToUse: any = null;
      let passageContent: any = null;

      if (existingPassages && existingPassages.length > 0) {
        passageToUse = existingPassages[0];
        
        try {
          passageContent = JSON.parse(passageToUse.content);
        } catch {
          passageContent = null;
        }
      }

      // If no valid passage exists, generate new one
      if (!passageToUse || !passageContent?.passage || !passageContent?.options) {
        setGenerating(true);
        
        const words: string[] = unitWords.length > 0 ? unitWords : [];

        const { data: genData, error: genError } = await supabase.functions.invoke("generate-gap-fill-passage", {
          body: {
            unit_id: unitId,
            unit_title: unitTitle,
            words,
            test_type_code: selectedTestType?.code
          }
        });

        if (genError) throw genError;

        if (!genData.success) {
          // Check if skipped (enough passages exist)
          if (genData.skipped) {
            // Reload to find an existing passage
            setGenerating(false);
            await loadGame();
            return;
          }
          throw new Error(genData.error || "Failed to generate content");
        }

        passageToUse = { id: genData.passage_id };
        passageContent = {
          passage: genData.passage,
          options: genData.options,
          answers: {} // We'll fetch answers from question_bank
        };
        questionIdsRef.current = genData.question_ids || [];
        
        setGenerating(false);
      }

      // Fetch questions to get correct answers
      const { data: questions } = await supabase
        .from("question_bank")
        .select("id, question_text, correct_answer")
        .eq("passage_id", passageToUse.id)
        .eq("game_id", gameData.id)
        .order("word", { ascending: true });

      if (questions && questions.length > 0) {
        const answersMap: Record<string, string> = {};
        questions.forEach((q) => {
          const gapNum = q.question_text.replace("Gap ", "");
          answersMap[gapNum] = q.correct_answer;
        });
        setCorrectAnswers(answersMap);
        questionIdsRef.current = questions.map(q => q.id);
      }

      setPassageId(passageToUse.id);
      setPassageTitle(passageToUse.title?.replace("Gap Fill Passage: ", "") || unitTitle);
      setPassage(passageContent.passage);
      setOptions(passageContent.options || []);

      // Start test session
      const testSession = await startSession({
        unitId,
        gameId: gameData.id,
        totalQuestions: configuredGaps,
        secondsPerQuestion: configuredSecondsPerQuestion
      });

      if (testSession) {
        sessionIdRef.current = testSession.sessionId;
        
        if (testSession.resumed && testSession.sessionData) {
          if (testSession.sessionData.selected_answers) {
            // Handle both object and array formats for backwards compatibility
            const restored = testSession.sessionData.selected_answers;
            if (typeof restored === 'object' && !Array.isArray(restored)) {
              setSelectedAnswers(restored as Record<number, string>);
            }
          }
        }
        
        if (testSession.isExpired) {
          toast({
            title: "Session Expired",
            description: "Your test time has expired. Submitting with current answers.",
            variant: "destructive"
          });
          isSubmittingRef.current = true;
          setSaving(true);
          await submitTestInternal();
          setShowResults(true);
        } else {
          setInitialTimeRemaining(testSession.remainingSeconds);
          startTimeRef.current = new Date(testSession.startedAt).getTime();
          setTimerActive(true);
        }
      }

    } catch (err) {
      console.error("Error loading gap fill passage game:", err);
      setError("Failed to load test. Please try again.");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleOptionSelect = async (gapNumber: number, optionLabel: string) => {
    const newAnswers = { ...selectedAnswers };
    
    // If clicking the same option, deselect it
    if (newAnswers[gapNumber] === optionLabel) {
      delete newAnswers[gapNumber];
    } else {
      newAnswers[gapNumber] = optionLabel;
    }
    
    setSelectedAnswers(newAnswers);
    
    // Save progress
    if (sessionIdRef.current) {
      saveProgress({
        sessionId: sessionIdRef.current,
        currentQuestion: Object.keys(newAnswers).length,
        selectedAnswers: newAnswers as any,
        questionIds: questionIdsRef.current
      });
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setTimerActive(false);
    setSaving(true);
    await submitTestInternal();
    setShowResults(true);
  };

  const submitTestInternal = async () => {
    if (!user || !gameId) return;
    
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      // Build answers array matching question_bank entries
      const answers = [];
      for (let i = 1; i <= numGaps; i++) {
        const questionId = questionIdsRef.current[i - 1];
        const selectedLabel = selectedAnswers[i] || "";
        answers.push({
          question_id: questionId,
          answer: selectedLabel // The label like "A", "B", etc.
        });
      }

      const { data, error } = await supabase.functions.invoke('submit-test-game', {
        body: {
          unit_id: unitId,
          game_id: gameId,
          answers,
          time_spent_seconds: timeSpentSeconds,
          passage_id: passageId
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit test');
      }

      setServerScore(data.score);
      setServerCorrectCount(data.correct_count);

    } catch (err: any) {
      console.error('Error submitting test:', err);
      toast({
        title: "Submission Error",
        description: err.message || "Failed to submit your test. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Get which gaps an option is assigned to
  const getOptionAssignments = (optionLabel: string): number[] => {
    const gaps: number[] = [];
    for (const [gap, label] of Object.entries(selectedAnswers)) {
      if (label === optionLabel) {
        gaps.push(parseInt(gap));
      }
    }
    return gaps;
  };

  // Check if option is already used
  const isOptionUsed = (optionLabel: string): boolean => {
    return Object.values(selectedAnswers).includes(optionLabel);
  };

  // Render passage with clickable gap markers
  const renderPassage = () => {
    const parts = passage.split(/(\[Gap \d+\])/g);
    
    return parts.map((part, index) => {
      const gapMatch = part.match(/\[Gap (\d+)\]/);
      if (gapMatch) {
        const gapNum = parseInt(gapMatch[1]);
        const selectedOption = selectedAnswers[gapNum];
        const optionText = options.find(o => o.label === selectedOption)?.text;
        
        return (
          <span 
            key={index}
            className={`inline-block mx-1 px-3 py-1 rounded-lg border-2 transition-all ${
              selectedOption 
                ? "bg-primary/10 border-primary text-primary font-medium"
                : "bg-muted border-dashed border-muted-foreground/50 text-muted-foreground"
            }`}
          >
            {selectedOption ? (
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{selectedOption}</Badge>
                <span className="text-sm">{optionText?.slice(0, 40)}...</span>
              </span>
            ) : (
              <span className="text-sm font-medium">Gap {gapNum}</span>
            )}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (loading || generating || sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Gap Fill Passage</h1>
            </div>
            <Button variant="outline" onClick={onBack} size="sm">
              Back
            </Button>
          </div>
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-4">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground">
                {generating ? "Generating passage and questions..." : "Loading game..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyCompleted || (showResults && previousScore !== null)) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Test Already Completed</h2>
            <p className="text-muted-foreground">
              You have already completed this test. Only one attempt is allowed.
            </p>
            {(previousScore !== null || serverScore > 0) && (
              <Badge variant="outline" className="text-lg px-6 py-2">
                Your Score: {previousScore ?? serverScore}%
              </Badge>
            )}
            <Button variant="outline" onClick={onBack} size="lg">
              Back to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <AlertTriangle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">{error}</h2>
            <Button variant="outline" onClick={onBack} size="lg">
              Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (showResults) {
    const isPerfect = serverCorrectCount === numGaps;
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            {isPerfect ? (
              <>
                <Trophy className="h-16 w-16 mx-auto text-success" />
                <h2 className="text-3xl font-bold text-success">Perfect Score!</h2>
                <p className="text-lg text-muted-foreground">
                  Excellent work! You've mastered gap-fill comprehension!
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📝</div>
                <h2 className="text-3xl font-bold">Test Complete</h2>
                <p className="text-lg text-muted-foreground">
                  You got {serverCorrectCount} out of {numGaps} correct.
                </p>
              </>
            )}
            
            <Badge variant={isPerfect ? "default" : "outline"} className="text-lg px-6 py-2">
              Score: {serverScore}%
            </Badge>

            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">This was your only attempt for this test.</span>
            </div>

            <Button variant="hero" onClick={onComplete} size="lg">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Continue
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedAnswers).length;
  const progress = (answeredCount / numGaps) * 100;

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">Gap Fill Passage</h1>
          </div>
          <div className="flex items-center gap-4">
            <GameTimer 
              formattedTime={timer.formattedTime}
              percentage={timer.percentage}
              timerColor={timer.timerColor}
              progressColor={timer.progressColor}
              isExpired={timer.isExpired}
            />
            <Button variant="outline" onClick={onBack} size="sm">
              Back
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Card className="p-4 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {answeredCount} / {numGaps} gaps filled
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </Card>

        {/* Main content - Side by side on desktop */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Passage */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <h2 className="text-xl font-bold mb-4">{passageTitle}</h2>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="text-base leading-relaxed whitespace-pre-wrap">
                {renderPassage()}
              </div>
            </ScrollArea>
          </Card>

          {/* Options Panel */}
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Sentence Bank</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedAnswers({})}
                disabled={answeredCount === 0}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Select an option below, then click on a gap in the passage to place it.
            </p>
            
            <ScrollArea className="h-[50vh]">
              <div className="space-y-3 pr-4">
                {options.map((option) => {
                  const assignments = getOptionAssignments(option.label);
                  const isUsed = assignments.length > 0;
                  
                  return (
                    <div
                      key={option.label}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isUsed 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Badge 
                          variant={isUsed ? "default" : "outline"}
                          className="shrink-0 mt-0.5"
                        >
                          {option.label}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{option.text}</p>
                          {isUsed && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">
                                Assigned to:
                              </span>
                              {assignments.map(gap => (
                                <Badge 
                                  key={gap} 
                                  variant="secondary" 
                                  className="text-xs cursor-pointer hover:bg-destructive/20"
                                  onClick={() => {
                                    const newAnswers = { ...selectedAnswers };
                                    delete newAnswers[gap];
                                    setSelectedAnswers(newAnswers);
                                  }}
                                >
                                  Gap {gap} ×
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Gap selection buttons */}
                      {!isUsed && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                          <span className="text-xs text-muted-foreground mr-2">Place in:</span>
                          {Array.from({ length: numGaps }, (_, i) => i + 1).map(gapNum => {
                            const isGapFilled = selectedAnswers[gapNum];
                            return (
                              <Button
                                key={gapNum}
                                variant={isGapFilled ? "ghost" : "outline"}
                                size="sm"
                                className={`h-7 px-2 text-xs ${isGapFilled ? "opacity-50" : ""}`}
                                onClick={() => handleOptionSelect(gapNum, option.label)}
                                disabled={!!isGapFilled}
                              >
                                Gap {gapNum}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Submit button */}
            <div className="mt-6 pt-4 border-t border-border">
              <Button 
                variant="hero" 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={saving || answeredCount < numGaps}
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Submit Test ({answeredCount}/{numGaps})
                  </>
                )}
              </Button>
              {answeredCount < numGaps && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Fill all {numGaps} gaps to submit
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
