import { useState, useEffect, useRef } from "react";
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
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const { user } = useAuth();
  const { selectedTestType } = useTestType();
  const { toast } = useToast();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    checkAttemptAndLoad();
    startTimeRef.current = Date.now();
  }, [unitId]);

  const checkAttemptAndLoad = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!user) {
        setError("Please log in to take this test.");
        setLoading(false);
        return;
      }

      // Check if already attempted
      const { data: attempts, error: attemptError } = await supabase
        .from('game_attempts')
        .select('score')
        .eq('user_id', user.id)
        .eq('unit_id', unitId)
        .eq('game_id', CONTEXT_MASTER_GAME_ID);

      if (attemptError) throw attemptError;

      if (attempts && attempts.length > 0) {
        setAlreadyAttempted(true);
        setPreviousScore(attempts[0].score);
        setLoading(false);
        return;
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

      // Format and randomize questions
      const allQuestions = data.questions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        word: q.word
      }));

      // Shuffle and take 15 questions
      const shuffled = allQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffled.slice(0, Math.min(15, shuffled.length)));

    } catch (err) {
      console.error('Error loading context master game:', err);
      setError("Failed to load test questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setSaving(true);
      await submitTest();
      setShowResults(true);
    }
  };

  const submitTest = async () => {
    if (!user) return;
    
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      const answers = selectedAnswers.map((answerIndex, questionIndex) => ({
        question_id: questions[questionIndex].id,
        answer_index: answerIndex
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

  if (loading) {
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

  if (alreadyAttempted) {
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
