import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { 
  PenTool, 
  Trophy,
  Zap,
  ArrowRight,
  Check,
  X,
  Loader2,
  Lightbulb
} from "lucide-react";
import { GameResultActions } from "./GameResultActions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface StoryCreatorGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

interface WordQuestion {
  word: string;
  userSentence: string;
  isCorrect: boolean | null;
  feedback: string;
  isPriority?: boolean;
}

export const StoryCreatorGame = ({ unitId, unitTitle, onComplete, onBack }: StoryCreatorGameProps) => {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<WordQuestion[]>([]);
  const [userInput, setUserInput] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<{ isCorrect: boolean; feedback: string } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const storageKey = `story_creator_play_all_words_next:${unitId}`;
    const playAllWordsNext = sessionStorage.getItem(storageKey) === "1";
    sessionStorage.removeItem(storageKey);

    fetchWords(playAllWordsNext);
    startTimeRef.current = Date.now();
  }, [unitId]);

  const fetchWords = async (playAllWords: boolean = false) => {
    setLoading(true);

    try {
      const { data: unit, error } = await supabase
        .from('units')
        .select('words')
        .eq('id', unitId)
        .single();

      if (error) throw error;
      
      if (!unit || !unit.words) {
        toast({
          title: "No words found",
          description: "This unit doesn't have any vocabulary words.",
          variant: "destructive",
        });
        onBack();
        return;
      }

      const wordList: string[] = Array.isArray(unit.words) 
        ? unit.words 
        : JSON.parse(unit.words as string);
      
      let finalWords: string[];
      let priorityWords: string[] = [];
      
      if (playAllWords) {
        finalWords = [...wordList].sort(() => Math.random() - 0.5);
      } else {
        // Initial play: prioritize incorrect words from last 3 attempts
        if (user) {
          const { data: prevAttempts } = await supabase
            .from('game_attempts')
            .select('id')
            .eq('user_id', user.id)
            .eq('unit_id', unitId)
            .eq('game_type', 'writing')
            .order('created_at', { ascending: false })
            .limit(3);

          if (prevAttempts && prevAttempts.length > 0) {
            const attemptIds = prevAttempts.map(a => a.id);
            
            const { data: incorrectAnswers } = await supabase
              .from('attempt_incorrect_answers_dictation')
              .select('incorrect_word')
              .in('attempt_id', attemptIds);

            if (incorrectAnswers && incorrectAnswers.length > 0) {
              const incorrectSet = new Set(incorrectAnswers.map(a => a.incorrect_word.toLowerCase()));
              priorityWords = wordList.filter(word => incorrectSet.has(word.toLowerCase()));
            }
          }
        }

        // If there are priority words, ONLY test those; otherwise test all words
        if (priorityWords.length > 0) {
          finalWords = [...priorityWords].sort(() => Math.random() - 0.5);
        } else {
          finalWords = [...wordList].sort(() => Math.random() - 0.5);
        }
      }
      
      setWords(finalWords);
      setQuestions(finalWords.map(word => ({
        word,
        userSentence: "",
        isCorrect: null,
        feedback: "",
        isPriority: priorityWords.includes(word)
      })));
    } catch (err) {
      console.error('Error fetching words:', err);
      toast({
        title: "Failed to load words",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const evaluateSentence = async (word: string, sentence: string): Promise<{ isCorrect: boolean; feedback: string }> => {
    try {
      const response = await supabase.functions.invoke('evaluate-sentence', {
        body: { word, sentence }
      });

      if (response.error) {
        console.error('Error evaluating sentence:', response.error);
        // Fallback: check if word is present in sentence
        const wordInSentence = sentence.toLowerCase().includes(word.toLowerCase());
        return {
          isCorrect: wordInSentence && sentence.trim().length > word.length + 5,
          feedback: wordInSentence 
            ? "Good attempt! The word is used in the sentence." 
            : `The word "${word}" should be used in your sentence.`
        };
      }

      return response.data;
    } catch (err) {
      console.error('Evaluation error:', err);
      // Fallback evaluation
      const wordInSentence = sentence.toLowerCase().includes(word.toLowerCase());
      return {
        isCorrect: wordInSentence && sentence.trim().length > word.length + 5,
        feedback: wordInSentence 
          ? "Good attempt! The word is used in the sentence." 
          : `The word "${word}" should be used in your sentence.`
      };
    }
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || evaluating) return;
    
    setEvaluating(true);
    const currentWord = words[currentIndex];
    
    try {
      const result = await evaluateSentence(currentWord, userInput.trim());
      
      // Update questions with the answer
      const updatedQuestions = [...questions];
      updatedQuestions[currentIndex] = {
        word: currentWord,
        userSentence: userInput.trim(),
        isCorrect: result.isCorrect,
        feedback: result.feedback
      };
      setQuestions(updatedQuestions);
      
      // Show feedback
      setCurrentFeedback(result);
      setShowFeedback(true);
    } catch (err) {
      console.error('Submit error:', err);
      toast({
        title: "Evaluation failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleNext = async () => {
    setShowFeedback(false);
    setCurrentFeedback(null);
    setUserInput("");
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResults(true);
      await saveGameAttempt();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      if (showFeedback) {
        handleNext();
      } else {
        handleSubmit();
      }
    }
  };

  const saveGameAttempt = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      // For writing game, we use the isCorrect flag from evaluate-sentence
      // But the final score/XP calculation is done server-side
      // We send the word and the correctness result from evaluate-sentence
      const answers = questions.map(q => ({
        word: q.word,
        // For writing game, use the word as user_answer if correct, otherwise a placeholder
        // The server will use this for correct counting
        user_answer: q.isCorrect ? q.word : `[incorrect]${q.userSentence.substring(0, 50)}`
      }));

      const { data, error } = await supabase.functions.invoke('submit-dictation-game', {
        body: {
          unit_id: unitId,
          game_type: 'writing',
          answers,
          time_spent_seconds: timeSpentSeconds
        }
      });

      if (error) {
        console.error('Server submission error:', error);
        toast({
          title: "Failed to save results",
          description: "Your progress could not be saved.",
          variant: "destructive",
        });
        return;
      }

      if (!data.success) {
        console.error('Submission failed:', data.error);
        toast({
          title: "Failed to save results",
          description: data.error || "Your progress could not be saved.",
          variant: "destructive",
        });
        return;
      }

      // Use server-calculated XP
      setEarnedXp(data.game_xp);
      setTimeout(() => setShowXpAnimation(true), 300);

    } catch (err) {
      console.error('Error saving game attempt:', err);
      toast({
        title: "Failed to save results",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getScore = () => {
    const correct = questions.filter(q => q.isCorrect).length;
    return Math.round((correct / questions.length) * 100);
  };

  const resetGame = (playAllWords: boolean = false) => {
    const storageKey = `story_creator_play_all_words_next:${unitId}`;
    if (playAllWords) {
      sessionStorage.setItem(storageKey, "1");
    } else {
      sessionStorage.removeItem(storageKey);
    }

    setCurrentIndex(0);
    setQuestions([]);
    setUserInput("");
    setShowResults(false);
    setShowFeedback(false);
    setCurrentFeedback(null);
    setEarnedXp(0);
    setShowXpAnimation(false);
    startTimeRef.current = Date.now();
    fetchWords(playAllWords);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = getScore();
    const isPerfect = score === 100;
    
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            {isPerfect ? (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <Trophy className="h-16 w-16 mx-auto text-success" />
                <h2 className="text-3xl font-bold text-success">Perfect Writing!</h2>
                <p className="text-lg text-muted-foreground">
                  You used every word correctly!
                </p>
                <Badge className="bg-gradient-success text-success-foreground text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">✍️</div>
                <h2 className="text-3xl font-bold">Great Writing!</h2>
                <p className="text-lg text-muted-foreground">
                  You correctly used {questions.filter(q => q.isCorrect).length} out of {questions.length} words.
                </p>
                <Badge variant="outline" className="text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
              </>
            )}

            {/* Results breakdown */}
            <div className="max-h-64 overflow-y-auto space-y-3 text-left">
              {questions.map((q, i) => (
                <div 
                  key={i}
                  className={`p-4 rounded-lg ${
                    q.isCorrect ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {q.isCorrect ? (
                      <Check className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">{q.word}</p>
                      <p className="text-sm text-muted-foreground italic">"{q.userSentence}"</p>
                      <p className="text-sm">{q.feedback}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* XP Animation */}
            <div 
              className={`
                flex items-center justify-center gap-2 py-3 px-6 rounded-full 
                bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30
                transition-all duration-500 ease-out
                ${showXpAnimation ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
              `}
            >
              <Zap className={`h-6 w-6 text-primary ${showXpAnimation ? 'animate-pulse' : ''}`} />
              <span className="text-xl font-bold text-primary">+{earnedXp} XP</span>
              {saving && <span className="text-sm text-muted-foreground">(saving...)</span>}
            </div>

            <GameResultActions
              onPlayAgain={() => resetGame(true)}
              onTryAgain={() => resetGame(false)}
              onBack={onBack}
              hasMistakes={!isPerfect}
            />
          </Card>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const progressPercent = ((currentIndex) / words.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PenTool className="h-6 w-6 text-primary" />
              Story Creator
            </h1>
            <p className="text-muted-foreground">{unitTitle}</p>
          </div>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{currentIndex + 1} of {words.length}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Main Game Area */}
        <Card className="p-8 space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          {showFeedback && currentFeedback ? (
            // Feedback State
            <div className="space-y-6">
              <div className={`text-center text-5xl ${currentFeedback.isCorrect ? 'animate-bounce' : ''}`}>
                {currentFeedback.isCorrect ? '🎉' : '🤔'}
              </div>
              
              <div className={`p-4 rounded-xl ${
                currentFeedback.isCorrect 
                  ? 'bg-success/10 border-2 border-success/30' 
                  : 'bg-destructive/10 border-2 border-destructive/30'
              }`}>
                {currentFeedback.isCorrect ? (
                  <div className="flex items-center justify-center gap-2 text-success mb-2">
                    <Check className="h-6 w-6" />
                    <span className="text-xl font-bold">Great sentence!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-destructive mb-2">
                    <X className="h-6 w-6" />
                    <span className="text-xl font-bold">Keep practicing!</span>
                  </div>
                )}
                <p className="text-center text-muted-foreground">{currentFeedback.feedback}</p>
              </div>

              <div className="flex justify-center">
                <Button onClick={handleNext} variant="game" size="lg">
                  {currentIndex < words.length - 1 ? (
                    <>
                      Next Word
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  ) : (
                    <>
                      See Results
                      <Trophy className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Writing State
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">Write a sentence using this word:</p>
                <div className="text-3xl font-bold py-4 px-6 bg-primary/10 rounded-xl border-2 border-primary/30 inline-block">
                  {currentWord}
                </div>
              </div>

              <div className="space-y-2">
                <Textarea
                  placeholder={`Write a creative sentence using "${currentWord}"...`}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  className="min-h-[120px] text-lg resize-none"
                  disabled={evaluating}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Tip: Use the word correctly in context. Press Ctrl+Enter to submit.
                </p>
              </div>

              <Button 
                onClick={handleSubmit} 
                variant="game" 
                size="lg" 
                className="w-full"
                disabled={!userInput.trim() || evaluating}
              >
                {evaluating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Submit Sentence
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
