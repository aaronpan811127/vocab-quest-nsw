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
  Trophy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    fetchPassageAndQuestions();
    startTimeRef.current = Date.now();
  }, [unitId]);

  const fetchPassageAndQuestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch a random passage for this unit
      const { data: passages, error: passageError } = await supabase
        .from('reading_passages')
        .select('*')
        .eq('unit_id', unitId);

      if (passageError) throw passageError;
      
      if (!passages || passages.length === 0) {
        setError("No passages available for this unit yet.");
        setLoading(false);
        return;
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

      if (!questionsData || questionsData.length === 0) {
        setError("No questions available for this passage.");
        setLoading(false);
        return;
      }

      const formattedQuestions: Question[] = questionsData.map(q => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as string),
        correct_answer: q.correct_answer
      }));

      setQuestions(formattedQuestions);
    } catch (err) {
      console.error('Error fetching reading game data:', err);
      setError("Failed to load game data. Please try again.");
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
      setShowResults(true);
      await saveGameAttempt();
    }
  };

  const saveGameAttempt = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const correctCount = selectedAnswers.filter((answer, index) => 
        questions[index].options[answer] === questions[index].correct_answer
      ).length;
      
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const score = Math.round((correctCount / questions.length) * 100);
      const isPerfect = correctCount === questions.length;
      
      setGameCompleted(isPerfect);

      // Calculate XP earned (base 10 XP + bonus for score)
      const xpEarned = Math.round(10 + (score / 10));

      // Insert game attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('game_attempts')
        .insert({
          user_id: user.id,
          unit_id: unitId,
          game_type: 'reading',
          score,
          correct_answers: correctCount,
          total_questions: questions.length,
          time_spent_seconds: timeSpentSeconds,
          completed: true
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Save incorrect answers
      const incorrectAnswers = selectedAnswers
        .map((answer, index) => ({
          questionIndex: index,
          userAnswer: questions[index].options[answer],
          isCorrect: questions[index].options[answer] === questions[index].correct_answer
        }))
        .filter(a => !a.isCorrect);

      if (incorrectAnswers.length > 0 && attempt) {
        const incorrectRecords = incorrectAnswers.map(a => ({
          attempt_id: attempt.id,
          question_id: questions[a.questionIndex].id,
          user_answer: a.userAnswer
        }));

        const { error: incorrectError } = await supabase
          .from('attempt_incorrect_answers')
          .insert(incorrectRecords);

        if (incorrectError) console.error('Error saving incorrect answers:', incorrectError);
      }

      // Update user profile XP and level
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_xp, level, last_study_date, study_streak')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const newXp = (profile.total_xp || 0) + xpEarned;
        const newLevel = Math.floor(newXp / 100) + 1; // Level up every 100 XP
        
        // Calculate streak
        const today = new Date().toISOString().split('T')[0];
        const lastStudy = profile.last_study_date;
        let newStreak = profile.study_streak || 0;
        
        if (lastStudy !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          if (lastStudy === yesterdayStr) {
            newStreak += 1;
          } else if (lastStudy !== today) {
            newStreak = 1;
          }
        }

        await supabase
          .from('profiles')
          .update({
            total_xp: newXp,
            level: newLevel,
            last_study_date: today,
            study_streak: newStreak
          })
          .eq('user_id', user.id);
      }

      // Update or create user_progress for this unit
      const { data: existingProgress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('unit_id', unitId)
        .maybeSingle();

      if (existingProgress) {
        const updates: Record<string, unknown> = {
          attempts: (existingProgress.attempts || 0) + 1,
          time_spent_minutes: (existingProgress.time_spent_minutes || 0) + Math.ceil(timeSpentSeconds / 60)
        };
        
        // Update reading score if better
        if (score > (existingProgress.reading_score || 0)) {
          updates.reading_score = score;
        }
        if (isPerfect) {
          updates.reading_completed = true;
        }

        await supabase
          .from('user_progress')
          .update(updates)
          .eq('id', existingProgress.id);
      } else {
        await supabase
          .from('user_progress')
          .insert({
            user_id: user.id,
            unit_id: unitId,
            reading_score: score,
            reading_completed: isPerfect,
            attempts: 1,
            time_spent_minutes: Math.ceil(timeSpentSeconds / 60)
          });
      }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
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
