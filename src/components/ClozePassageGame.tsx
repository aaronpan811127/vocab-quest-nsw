import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText,
  ArrowRight,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Lock,
  BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { useToast } from "@/hooks/use-toast";
import { useCelebration } from "@/hooks/useCelebration";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useTestSession } from "@/hooks/useTestSession";
import { GameTimer } from "@/components/GameTimer";

interface Extract {
  label: string;
  title: string;
  content: string;
  text_type: string;
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  explanation?: string;
}

interface ClozePassageGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

const DEFAULT_SECONDS_PER_QUESTION = 45; // More time for passage-based questions

export const ClozePassageGame = ({ unitId, unitTitle, onComplete, onBack }: ClozePassageGameProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [extracts, setExtracts] = useState<Extract[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
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
    totalQuestions: questions.length,
    secondsPerQuestion,
    onTimeUp: handleTimeUp,
    isActive: timerActive && !showResults && !loading && questions.length > 0,
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
        totalQuestions: questions.length,
        gameName: 'Cloze Passage'
      });
    }
  }, [showResults, serverCorrectCount, questions.length, celebrate]);

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

      // Get the game ID for cloze_passage
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, rules")
        .eq("game_type", "cloze_passage")
        .single();

      if (gameError || !gameData) {
        console.error("Error fetching game:", gameError);
        setError("Cloze Passage game not configured.");
        setLoading(false);
        return;
      }

      setGameId(gameData.id);
      const rules = gameData.rules as Record<string, unknown> | null;
      const configuredSecondsPerQuestion = (rules?.seconds_per_question as number) || DEFAULT_SECONDS_PER_QUESTION;
      setSecondsPerQuestion(configuredSecondsPerQuestion);

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
        // Already completed - show result
        setServerScore(existingAttempt.score);
        setShowResults(true);
        setLoading(false);
        return;
      }

      // Check for existing passage and questions for this unit
      const { data: existingPassages, error: passageError } = await supabase
        .from("reading_passages")
        .select("id, content")
        .eq("unit_id", unitId)
        .eq("is_generated", true)
        .ilike("title", "Cloze Passage:%");

      let passageToUse: any = null;
      let extractsData: Extract[] = [];
      let questionsData: Question[] = [];

      if (existingPassages && existingPassages.length > 0) {
        // Use existing passage
        passageToUse = existingPassages[0];
        
        try {
          extractsData = JSON.parse(passageToUse.content);
        } catch {
          extractsData = [];
        }

        // Fetch questions for this passage
        const { data: existingQuestions } = await supabase
          .from("questions_for_play")
          .select("id, question_text, options")
          .eq("passage_id", passageToUse.id)
          .eq("game_id", gameData.id);

        if (existingQuestions && existingQuestions.length > 0) {
          questionsData = existingQuestions.map(q => ({
            id: q.id,
            question_text: q.question_text,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
          }));
        }
      }

      // If no passage or questions, generate new ones
      if (!passageToUse || extractsData.length === 0 || questionsData.length === 0) {
        setGenerating(true);
        
        // Fetch unit words
        const { data: unitData } = await supabase
          .from("units")
          .select("words")
          .eq("id", unitId)
          .single();

        const words: string[] = Array.isArray(unitData?.words) ? unitData.words as string[] : [];

        // Generate new content
        const { data: genData, error: genError } = await supabase.functions.invoke("generate-cloze-passage", {
          body: {
            unit_id: unitId,
            unit_title: unitTitle,
            words,
            test_type_code: selectedTestType?.code
          }
        });

        if (genError) throw genError;

        if (!genData.success) {
          throw new Error(genData.error || "Failed to generate content");
        }

        passageToUse = { id: genData.passage_id };
        extractsData = genData.extracts;
        questionsData = genData.questions;
        
        setGenerating(false);
      }

      setPassageId(passageToUse.id);
      setExtracts(extractsData);
      setQuestions(questionsData);
      questionIdsRef.current = questionsData.map(q => q.id);

      // Start test session
      const testSession = await startSession({
        unitId,
        gameId: gameData.id,
        totalQuestions: questionsData.length,
        secondsPerQuestion: configuredSecondsPerQuestion
      });

      if (testSession) {
        sessionIdRef.current = testSession.sessionId;
        
        // Restore progress if resuming
        if (testSession.resumed && testSession.sessionData) {
          if (testSession.sessionData.selected_answers) {
            setSelectedAnswers(testSession.sessionData.selected_answers);
          }
          if (typeof testSession.sessionData.current_question === 'number') {
            setCurrentQuestion(testSession.sessionData.current_question);
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
      console.error("Error loading cloze passage game:", err);
      setError("Failed to load test. Please try again.");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleAnswerSelect = async (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
    
    // Save progress after each answer
    if (sessionIdRef.current) {
      saveProgress({
        sessionId: sessionIdRef.current,
        currentQuestion,
        selectedAnswers: newAnswers,
        questionIds: questionIdsRef.current
      });
    }
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      
      if (sessionIdRef.current) {
        saveProgress({
          sessionId: sessionIdRef.current,
          currentQuestion: nextQuestion,
          selectedAnswers,
          questionIds: questionIdsRef.current
        });
      }
    } else {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setTimerActive(false);
      setSaving(true);
      await submitTestInternal();
      setShowResults(true);
    }
  };

  const submitTestInternal = async () => {
    if (!user || !gameId) return;
    
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      const answers = selectedAnswers.map((answerIndex, questionIndex) => ({
        question_id: questions[questionIndex]?.id,
        answer_index: answerIndex ?? -1
      }));

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

  if (loading || generating || sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Cloze Passage</h1>
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
    const isPerfect = serverCorrectCount === questions.length;
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            {isPerfect ? (
              <>
                <Trophy className="h-16 w-16 mx-auto text-success" />
                <h2 className="text-3xl font-bold text-success">Perfect Score!</h2>
                <p className="text-lg text-muted-foreground">
                  Excellent work! You've mastered reading comprehension!
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📖</div>
                <h2 className="text-3xl font-bold">Test Complete</h2>
                <p className="text-lg text-muted-foreground">
                  You got {serverCorrectCount} out of {questions.length} correct.
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

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold">Cloze Passage</h1>
            <Badge className="bg-gradient-primary text-primary-foreground hidden sm:inline-flex">
              {unitTitle}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs sm:text-sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              One Attempt
            </Badge>
            <Button variant="outline" onClick={onBack} size="sm">
              Back
            </Button>
          </div>
        </div>

        {/* Timer */}
        <GameTimer
          formattedTime={timer.formattedTime}
          percentage={timer.percentage}
          timerColor={timer.timerColor}
          progressColor={timer.progressColor}
          isExpired={timer.isExpired}
        />

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Main content - Extracts and Question side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Extracts Panel */}
          <Card className="bg-card/50 backdrop-blur-sm border-2 border-border/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Reading Extracts</h2>
            </div>
            <ScrollArea className="h-[400px] lg:h-[500px] pr-4">
              <div className="space-y-4">
                {extracts.map((extract, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-background/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-bold">
                        Extract {extract.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground italic">
                        ({extract.text_type})
                      </span>
                    </div>
                    {extract.title && (
                      <h3 className="font-medium text-sm mb-2">{extract.title}</h3>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {extract.content}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Question Panel */}
          <Card className="bg-card/50 backdrop-blur-sm border-2 border-border/50 p-6">
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  Question {currentQuestion + 1}
                </Badge>
                <h3 className="text-lg font-medium leading-relaxed">
                  {currentQ?.question_text}
                </h3>
              </div>

              {/* Answer Options */}
              <div className="space-y-3">
                {currentQ?.options.map((option, index) => {
                  const isSelected = selectedAnswers[currentQuestion] === index;
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {option}
                        </div>
                        <span className="font-medium">Extract {option}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex justify-end pt-4">
                <Button
                  variant="game"
                  onClick={handleNext}
                  disabled={selectedAnswers[currentQuestion] === undefined || saving}
                  size="lg"
                >
                  {saving ? (
                    "Saving..."
                  ) : currentQuestion < questions.length - 1 ? (
                    <>
                      Next Question
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  ) : (
                    <>
                      Submit Test
                      <CheckCircle2 className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
