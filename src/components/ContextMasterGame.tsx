import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target,
  ArrowRight,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";
import { useToast } from "@/hooks/use-toast";
import { useCelebration } from "@/hooks/useCelebration";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useTestSession } from "@/hooks/useTestSession";
import { GameTimer } from "@/components/GameTimer";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  word: string;
}

interface ContextMasterGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

const CONTEXT_MASTER_GAME_ID = 'c6d9e0f1-a2b3-4c5d-8e6f-7a8b9c0d1e2f';
const DEFAULT_SECONDS_PER_QUESTION = 30;

export const ContextMasterGame = ({ unitId, unitTitle, onComplete, onBack }: ContextMasterGameProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverScore, setServerScore] = useState(0);
  const [serverCorrectCount, setServerCorrectCount] = useState(0);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(DEFAULT_SECONDS_PER_QUESTION);
  const [timerActive, setTimerActive] = useState(false);
  const [initialTimeRemaining, setInitialTimeRemaining] = useState<number | undefined>(undefined);
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
    checkAttemptAndLoad();
  }, [unitId]);

  // Trigger celebration when showing results
  useEffect(() => {
    if (showResults && !hasCelebrated.current) {
      hasCelebrated.current = true;
      celebrate({
        score: serverCorrectCount,
        totalQuestions: questions.length,
        gameName: 'Context Master'
      });
    }
  }, [showResults, serverCorrectCount, questions.length, celebrate]);

  const checkAttemptAndLoad = async () => {
    setLoading(true);
    setError(null);
    setTimerActive(false);
    
    try {
      if (!user) {
        setError("Please log in to take this test.");
        setLoading(false);
        return;
      }

      // Fetch game rules for timer configuration
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('rules')
        .eq('id', CONTEXT_MASTER_GAME_ID)
        .single();

      let configuredSecondsPerQuestion = DEFAULT_SECONDS_PER_QUESTION;
      if (!gameError && gameData?.rules) {
        const rules = gameData.rules as Record<string, unknown>;
        const configuredSeconds = rules.seconds_per_question;
        if (typeof configuredSeconds === 'number' && configuredSeconds > 0) {
          configuredSecondsPerQuestion = configuredSeconds;
          setSecondsPerQuestion(configuredSecondsPerQuestion);
        }
      }

      // Fetch unit words
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('words')
        .eq('id', unitId)
        .single();

      if (unitError) throw unitError;

      const words: string[] = Array.isArray(unitData?.words) ? unitData.words as string[] : [];
      if (words.length === 0) {
        setError("No vocabulary words found for this unit.");
        setLoading(false);
        return;
      }

      // Try to generate or fetch questions
      const { data, error: genError } = await supabase.functions.invoke('generate-test-questions', {
        body: {
          unit_id: unitId,
          words,
          game_type: 'context_master',
          game_id: CONTEXT_MASTER_GAME_ID,
          test_type_code: selectedTestType?.code
        }
      });

      if (genError) throw genError;

      if (!data.success) {
        throw new Error(data.error || 'Failed to load questions');
      }

      // Format questions
      const allQuestions: Question[] = data.questions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        word: q.word
      }));
      
      // Start or resume test session first to check for saved progress
      const testSession = await startSession({
        unitId,
        gameId: CONTEXT_MASTER_GAME_ID,
        totalQuestions: Math.min(15, allQuestions.length),
        secondsPerQuestion: configuredSecondsPerQuestion
      });

      let selectedQuestions: Question[];
      
      // Check if we have saved session data with question order
      if (testSession?.sessionData?.question_ids && testSession.sessionData.question_ids.length > 0) {
        // Restore questions in the saved order
        const questionMap = new Map(allQuestions.map(q => [q.id, q]));
        selectedQuestions = testSession.sessionData.question_ids
          .map(id => questionMap.get(id))
          .filter((q): q is Question => q !== undefined);
        
        // Restore answers and current question
        if (testSession.sessionData.selected_answers) {
          setSelectedAnswers(testSession.sessionData.selected_answers);
        }
        if (typeof testSession.sessionData.current_question === 'number') {
          setCurrentQuestion(testSession.sessionData.current_question);
        }
      } else {
        // New session - shuffle and take 15 questions
        const shuffled = allQuestions.sort(() => Math.random() - 0.5);
        selectedQuestions = shuffled.slice(0, Math.min(15, shuffled.length));
      }
      
      setQuestions(selectedQuestions);
      questionIdsRef.current = selectedQuestions.map(q => q.id);

      if (testSession) {
        sessionIdRef.current = testSession.sessionId;
        
        // Save initial question order if new session
        if (!testSession.resumed && selectedQuestions.length > 0) {
          saveProgress({
            sessionId: testSession.sessionId,
            currentQuestion: 0,
            selectedAnswers: [],
            questionIds: selectedQuestions.map(q => q.id)
          });
        }
        
        if (testSession.isExpired) {
          // Session already expired - auto-submit
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
          // Set initial time from session
          setInitialTimeRemaining(testSession.remainingSeconds);
          startTimeRef.current = new Date(testSession.startedAt).getTime();
          
          if (testSession.resumed && testSession.sessionData) {
            const answeredCount = testSession.sessionData.selected_answers?.filter((a: number) => a !== undefined && a !== -1).length || 0;
            toast({
              title: "Session Resumed",
              description: `Continuing from question ${(testSession.sessionData.current_question || 0) + 1}. ${answeredCount} answered.`,
            });
          }
          
          setTimerActive(true);
        }
      }

    } catch (err) {
      console.error('Error loading context master game:', err);
      setError("Failed to load test questions. Please try again.");
    } finally {
      setLoading(false);
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
      
      // Save progress when moving to next question
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
    if (!user) return;
    
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      const answers = selectedAnswers.map((answerIndex, questionIndex) => ({
        question_id: questions[questionIndex]?.id,
        answer_index: answerIndex ?? -1 // -1 for unanswered questions
      }));

      const { data, error } = await supabase.functions.invoke('submit-test-game', {
        body: {
          unit_id: unitId,
          game_id: CONTEXT_MASTER_GAME_ID,
          answers,
          time_spent_seconds: timeSpentSeconds
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

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Test Already Completed</h2>
            <p className="text-muted-foreground">
              You have already completed this test. Only one attempt is allowed.
            </p>
            {previousScore !== null && (
              <Badge variant="outline" className="text-lg px-6 py-2">
                Your Score: {previousScore}%
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
                  Excellent work! You've mastered all the vocabulary!
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📝</div>
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
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Context Master</h1>
            <Badge className="bg-gradient-primary text-primary-foreground">
              {unitTitle}
            </Badge>
          </div>
          <Badge variant="outline" className="text-sm">
            <AlertTriangle className="h-3 w-3 mr-1" />
            One Attempt Only
          </Badge>
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

        {/* Question */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          <div className="space-y-6">
            <div className="text-center">
              <Badge variant="secondary" className="mb-4">
                Testing: {currentQ?.word}
              </Badge>
              <h2 className="text-xl font-semibold">{currentQ?.question_text}</h2>
            </div>

            {/* Answer options */}
            <div className="grid gap-3">
              {currentQ?.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  className={`
                    p-4 rounded-lg text-left transition-all duration-200 border-2
                    ${selectedAnswers[currentQuestion] === index 
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'}
                  `}
                >
                  <span className="font-medium mr-3">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex justify-end">
          <Button 
            variant="hero" 
            onClick={handleNext}
            disabled={selectedAnswers[currentQuestion] === undefined || saving}
            size="lg"
          >
            {saving ? (
              "Submitting..."
            ) : currentQuestion < questions.length - 1 ? (
              <>
                Next
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            ) : (
              "Submit Test"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
