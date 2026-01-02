import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  ArrowRight,
  RotateCcw,
  Trophy,
  Zap,
  Sparkles,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
}

interface Passage {
  id: string;
  title: string;
  content: string;
  highlighted_words: string[];
}

interface ReadingGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

export const ReadingGame = ({ unitId, unitTitle, onComplete, onBack }: ReadingGameProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const startTimeRef = useRef<number>(Date.now());
  const attemptedQuestionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchPassageAndQuestions();
    startTimeRef.current = Date.now();
  }, [unitId]);

  const fetchPassageAndQuestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all passages for this unit
      const { data: passages, error: passageError } = await supabase
        .from('reading_passages')
        .select('*')
        .eq('unit_id', unitId);

      if (passageError) throw passageError;
      
      if (!passages || passages.length === 0) {
        // No passages at all - need to generate one
        console.log('No passages available, generating new one...');
        await generateNewPassage();
        return;
      }

      // Get user's completed passage IDs to avoid repetition
      let completedPassageIds: string[] = [];
      if (user) {
        const { data: attempts } = await supabase
          .from('game_attempts')
          .select('unit_id')
          .eq('user_id', user.id)
          .eq('unit_id', unitId)
          .eq('completed', true);
        
        // Track question IDs the user has seen
        const { data: previousAttempts } = await supabase
          .from('attempt_incorrect_answers')
          .select('question_id, game_attempts!inner(user_id, unit_id)')
          .eq('game_attempts.user_id', user.id)
          .eq('game_attempts.unit_id', unitId);

        if (previousAttempts) {
          previousAttempts.forEach(a => attemptedQuestionIdsRef.current.add(a.question_id));
        }
      }

      // Select a random passage
      const randomPassage = passages[Math.floor(Math.random() * passages.length)];
      setPassage({
        id: randomPassage.id,
        title: randomPassage.title,
        content: randomPassage.content,
        highlighted_words: randomPassage.highlighted_words || []
      });

      // Fetch questions for this passage
      const { data: questionsData, error: questionsError } = await supabase
        .from('question_bank')
        .select('*')
        .eq('passage_id', randomPassage.id)
        .eq('game_type', 'reading');

      if (questionsError) throw questionsError;

      // Filter to get unattempted questions
      const unattemptedQuestions = questionsData?.filter(
        q => !attemptedQuestionIdsRef.current.has(q.id)
      ) || [];

      // If all questions in ALL passages have been attempted, offer to generate a new passage
      if (unattemptedQuestions.length === 0) {
        // Check if there are any unattempted questions in other passages
        const { data: allQuestions } = await supabase
          .from('question_bank')
          .select('id, passage_id')
          .eq('unit_id', unitId)
          .eq('game_type', 'reading');

        const allUnattempted = allQuestions?.filter(
          q => !attemptedQuestionIdsRef.current.has(q.id)
        ) || [];

        if (allUnattempted.length === 0) {
          // All questions exhausted - generate a new passage
          console.log('All questions in unit exhausted, generating new passage...');
          await generateNewPassage();
          return;
        } else {
          // Find a passage with unattempted questions
          const passageWithQuestions = passages.find(p => 
            allUnattempted.some(q => q.passage_id === p.id)
          );
          if (passageWithQuestions) {
            setPassage({
              id: passageWithQuestions.id,
              title: passageWithQuestions.title,
              content: passageWithQuestions.content,
              highlighted_words: passageWithQuestions.highlighted_words || []
            });
            
            const { data: passageQuestions } = await supabase
              .from('question_bank')
              .select('*')
              .eq('passage_id', passageWithQuestions.id)
              .eq('game_type', 'reading');

            const filtered = passageQuestions?.filter(
              q => !attemptedQuestionIdsRef.current.has(q.id)
            ) || [];

            const formattedQuestions: Question[] = filtered.map(q => ({
              id: q.id,
              question_text: q.question_text,
              options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
              correct_answer: q.correct_answer
            }));

            const shuffled = formattedQuestions.sort(() => Math.random() - 0.5);
            setQuestions(shuffled.slice(0, Math.min(10, shuffled.length)));
            setLoading(false);
            return;
          }
        }
      }

      // Use the questions we have
      const questionsToUse = unattemptedQuestions.length > 0 ? unattemptedQuestions : (questionsData || []);

      const formattedQuestions: Question[] = questionsToUse.map(q => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
        correct_answer: q.correct_answer
      }));

      // Shuffle and take up to 10 questions
      const shuffled = formattedQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffled.slice(0, Math.min(10, shuffled.length)));
    } catch (err) {
      console.error('Error fetching reading game data:', err);
      setError("Failed to load game data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateNewPassage = async () => {
    setGeneratingQuestions(true);
    
    try {
      // Check remaining generations first
      const { data: existingGenerated } = await supabase
        .from('reading_passages')
        .select('id')
        .eq('generated_by', user?.id)
        .eq('is_generated', true);

      const remaining = 5 - (existingGenerated?.length || 0);

      if (remaining <= 0) {
        // Silently fall back to existing passages without showing toast
        const { data: anyPassages } = await supabase
          .from('reading_passages')
          .select('*')
          .eq('unit_id', unitId);

        if (anyPassages && anyPassages.length > 0) {
          // Pick a random passage from existing ones
          const randomPassage = anyPassages[Math.floor(Math.random() * anyPassages.length)];
          await loadPassageWithQuestions(randomPassage);
        } else {
          setError("No passages available for this unit.");
        }
        return;
      }

      // No toast for starting generation - only show on failure

      const { data, error } = await supabase.functions.invoke('generate-passage', {
        body: {
          unit_id: unitId,
          unit_title: unitTitle
        }
      });

      if (error) {
        console.error('Error generating passage:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate passage');
      }

      // Success - no toast needed, just load the content

      // Set the new passage
      setPassage({
        id: data.passage.id,
        title: data.passage.title,
        content: data.passage.content,
        highlighted_words: data.passage.highlighted_words || []
      });

      // Format and set the new questions
      const formattedQuestions: Question[] = data.questions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
        correct_answer: q.correct_answer
      }));

      setQuestions(formattedQuestions.slice(0, 10));
    } catch (err: any) {
      console.error('Error generating passage:', err);
      
      // Handle specific errors
      if (err.message?.includes('Rate limit') || err.message?.includes('429')) {
        toast({
          title: "Rate limit exceeded",
          description: "Please wait a moment before trying again.",
          variant: "destructive",
        });
      } else if (err.message?.includes('402') || err.message?.includes('credits')) {
        toast({
          title: "AI credits needed",
          description: "Please add credits to continue generating content.",
          variant: "destructive",
        });
      } else if (err.message?.includes('maximum')) {
        toast({
          title: "Generation limit reached",
          description: err.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation failed",
          description: "Could not generate new passage. Using existing ones.",
          variant: "destructive",
        });
      }

      // Fall back to existing passages
      const { data: existingPassages } = await supabase
        .from('reading_passages')
        .select('*')
        .eq('unit_id', unitId);

      if (existingPassages && existingPassages.length > 0) {
        await loadPassageWithQuestions(existingPassages[0]);
      } else {
        setError("No passages available for this unit.");
      }
    } finally {
      setGeneratingQuestions(false);
      setLoading(false);
    }
  };

  const loadPassageWithQuestions = async (passageData: any) => {
    setPassage({
      id: passageData.id,
      title: passageData.title,
      content: passageData.content,
      highlighted_words: passageData.highlighted_words || []
    });

    const { data: questionsData } = await supabase
      .from('question_bank')
      .select('*')
      .eq('passage_id', passageData.id)
      .eq('game_type', 'reading');

    if (questionsData && questionsData.length > 0) {
      const formattedQuestions: Question[] = questionsData.map(q => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
        correct_answer: q.correct_answer
      }));
      const shuffled = formattedQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffled.slice(0, Math.min(10, shuffled.length)));
    } else {
      setError("No questions available for this passage.");
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
      setShowResults(true);
      await saveGameAttempt();
    }
  };

  const saveGameAttempt = async () => {
    if (!user || !passage) return;
    
    setSaving(true);
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      // Prepare answers for server-side validation
      const answers = selectedAnswers.map((answerIndex, questionIndex) => ({
        question_id: questions[questionIndex].id,
        answer_index: answerIndex
      }));

      // Submit to server-side function for secure validation
      const { data, error } = await supabase.functions.invoke('submit-game', {
        body: {
          unit_id: unitId,
          passage_id: passage.id,
          answers,
          time_spent_seconds: timeSpentSeconds
        }
      });

      if (error) {
        console.error('Error submitting game:', error);
        throw error;
      }

      if (!data.success) {
        console.error('Game submission failed:', data.error);
        throw new Error(data.error || 'Failed to submit game');
      }

      // Use server-calculated values
      setEarnedXp(data.xp_earned);
      setGameCompleted(data.is_perfect);
      
      // Trigger XP animation after a short delay
      setTimeout(() => setShowXpAnimation(true), 300);

    } catch (err) {
      console.error('Error saving game attempt:', err);
    } finally {
      setSaving(false);
    }
  };

  const getScore = () => {
    const correctAnswers = selectedAnswers.filter((answer, index) => 
      questions[index].options[answer] === questions[index].correct_answer
    ).length;
    return Math.round((correctAnswers / questions.length) * 100);
  };

  const getCorrectCount = () => {
    return selectedAnswers.filter((answer, index) => 
      questions[index].options[answer] === questions[index].correct_answer
    ).length;
  };

  const resetGame = () => {
    setCurrentQuestion(0);
    setSelectedAnswers([]);
    setShowResults(false);
    setGameCompleted(false);
    setEarnedXp(0);
    setShowXpAnimation(false);
    startTimeRef.current = Date.now();
    fetchPassageAndQuestions();
  };

  const renderHighlightedContent = (content: string) => {
    // Split by ** markers for highlighted words
    return content.split('**').map((part, index) => 
      index % 2 === 0 ? (
        <span key={index}>{part}</span>
      ) : (
        <strong key={index} className="text-primary font-bold bg-primary/10 px-1 rounded">
          {part}
        </strong>
      )
    );
  };

  if (loading || generatingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          {generatingQuestions && (
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-primary/30">
              <div className="flex items-center justify-center gap-3">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                <span className="text-lg font-medium">Generating new questions with AI...</span>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </Card>
          )}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold">{error}</h2>
            <p className="text-muted-foreground">
              Please check back later or try a different unit.
            </p>
            <Button variant="outline" onClick={onBack} size="lg">
              Back to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = getScore();
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            {gameCompleted ? (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <Trophy className="h-16 w-16 mx-auto text-success" />
                <h2 className="text-3xl font-bold text-success">Perfect Score!</h2>
                <p className="text-lg text-muted-foreground">
                  You've mastered all the vocabulary in this passage!
                </p>
                <Badge className="bg-gradient-success text-success-foreground text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📚</div>
                <h2 className="text-3xl font-bold">Good Effort!</h2>
                <p className="text-lg text-muted-foreground">
                  You got {getCorrectCount()} out of {questions.length} correct.
                </p>
                <Badge variant="outline" className="text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Try again with a new passage for more practice.
                </p>
              </>
            )}

            {/* XP Earned Animation */}
            <div 
              className={`
                flex items-center justify-center gap-2 py-3 px-6 rounded-full 
                bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30
                transition-all duration-500 ease-out
                ${showXpAnimation 
                  ? 'opacity-100 translate-y-0 scale-100' 
                  : 'opacity-0 translate-y-4 scale-95'}
              `}
            >
              <Zap className={`h-6 w-6 text-primary ${showXpAnimation ? 'animate-pulse' : ''}`} />
              <span className="text-xl font-bold text-primary">+{earnedXp} XP</span>
              {saving && <span className="text-sm text-muted-foreground">(saving...)</span>}
            </div>

            <div className="flex justify-center gap-4 pt-4">
              {gameCompleted ? (
                <Button variant="hero" onClick={onComplete} size="lg">
                  <Trophy className="h-5 w-5 mr-2" />
                  Complete Game
                </Button>
              ) : (
                <Button variant="game" onClick={resetGame} size="lg">
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Try New Passage
                </Button>
              )}
              <Button variant="outline" onClick={onBack} size="lg">
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Reading Quest</h1>
            <Badge className="bg-gradient-primary text-primary-foreground">
              {unitTitle}
            </Badge>
          </div>
          <Button variant="outline" onClick={onBack}>
            Back to Dashboard
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Passage */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {passage?.title || 'Reading Passage'}
          </h3>
          <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
            {passage && renderHighlightedContent(passage.content)}
          </div>
        </Card>

        {/* Question */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          <h3 className="text-lg font-semibold mb-4">
            {questions[currentQuestion]?.question_text}
          </h3>
          <div className="space-y-3">
            {questions[currentQuestion]?.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                className={`
                  w-full p-4 text-left rounded-lg border-2 transition-all duration-300
                  ${selectedAnswers[currentQuestion] === index
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-card/80'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold
                    ${selectedAnswers[currentQuestion] === index
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground'
                    }
                  `}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  {option}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleNext}
              disabled={selectedAnswers[currentQuestion] === undefined}
              variant="hero"
              size="lg"
            >
              {currentQuestion === questions.length - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
