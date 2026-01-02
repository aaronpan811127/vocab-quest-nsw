import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Headphones, 
  Volume2, 
  RotateCcw,
  Trophy,
  Zap,
  ArrowRight,
  Check,
  X,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ListeningGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

interface WordQuestion {
  word: string;
  userAnswer: string;
  isCorrect: boolean | null;
  isPriority?: boolean; // From previous incorrect answers
}

export const ListeningGame = ({ unitId, unitTitle, onComplete, onBack }: ListeningGameProps) => {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<WordQuestion[]>([]);
  const [userInput, setUserInput] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<{ isCorrect: boolean; correctWord: string } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const startTimeRef = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    fetchWords();
    startTimeRef.current = Date.now();
    
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [unitId]);

  useEffect(() => {
    // Auto-play word when moving to a new question
    if (words.length > 0 && currentIndex < words.length && !showResults && !showFeedback) {
      setHasPlayed(false);
      const timer = setTimeout(() => {
        playWord(words[currentIndex]);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, words, showResults, showFeedback]);

  useEffect(() => {
    // Focus input after playing
    if (hasPlayed && inputRef.current && !showFeedback) {
      inputRef.current.focus();
    }
  }, [hasPlayed, showFeedback]);

  const fetchWords = async () => {
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

      // Parse words - they come as an array
      const wordList: string[] = Array.isArray(unit.words) 
        ? unit.words 
        : JSON.parse(unit.words as string);
      
      // Fetch previous incorrect answers from dictation table for this user and unit
      let priorityWords: string[] = [];
      if (user) {
        const { data: prevAttempts } = await supabase
          .from('game_attempts')
          .select('id')
          .eq('user_id', user.id)
          .eq('unit_id', unitId)
          .eq('game_type', 'listening');

        if (prevAttempts && prevAttempts.length > 0) {
          const attemptIds = prevAttempts.map(a => a.id);
          
          // Get incorrect words from all previous attempts
          const { data: incorrectAnswers } = await supabase
            .from('attempt_incorrect_answers_dictation')
            .select('incorrect_word')
            .in('attempt_id', attemptIds);

          if (incorrectAnswers) {
            // Get unique incorrect words that are still in the unit's word list
            const incorrectSet = new Set(incorrectAnswers.map(a => a.incorrect_word.toLowerCase()));
            priorityWords = wordList.filter(word => incorrectSet.has(word.toLowerCase()));
          }
        }
      }

      // Create word selection: prioritize previously incorrect words
      const shuffledPriority = [...priorityWords].sort(() => Math.random() - 0.5);
      const remainingWords = wordList.filter(w => !priorityWords.includes(w));
      const shuffledRemaining = [...remainingWords].sort(() => Math.random() - 0.5);
      
      // Take priority words first, then fill with remaining
      const maxWords = Math.min(10, wordList.length);
      const selectedPriority = shuffledPriority.slice(0, Math.min(5, maxWords, shuffledPriority.length));
      const selectedRemaining = shuffledRemaining.slice(0, maxWords - selectedPriority.length);
      const selectedWords = [...selectedPriority, ...selectedRemaining];
      
      // Shuffle the final selection so priority words aren't always first
      const finalWords = [...selectedWords].sort(() => Math.random() - 0.5);
      
      setWords(finalWords);
      setQuestions(finalWords.map(word => ({
        word,
        userAnswer: "",
        isCorrect: null,
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

  const playWord = useCallback((word: string) => {
    if (!synthRef.current) return;
    
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    setIsPlaying(true);
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8; // Slower for kids
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to use a good English voice
    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Female')) 
      || voices.find(v => v.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.onend = () => {
      setIsPlaying(false);
      setHasPlayed(true);
    };
    
    utterance.onerror = () => {
      setIsPlaying(false);
      setHasPlayed(true);
    };
    
    synthRef.current.speak(utterance);
  }, []);

  const handleSubmit = () => {
    if (!userInput.trim() || showFeedback) return;
    
    const currentWord = words[currentIndex];
    const isCorrect = userInput.trim().toLowerCase() === currentWord.toLowerCase();
    
    // Update questions with the answer
    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex] = {
      word: currentWord,
      userAnswer: userInput.trim(),
      isCorrect
    };
    setQuestions(updatedQuestions);
    
    // Show feedback
    setCurrentFeedback({ isCorrect, correctWord: currentWord });
    setShowFeedback(true);
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
    if (e.key === 'Enter') {
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
      const correctCount = questions.filter(q => q.isCorrect).length;
      const score = Math.round((correctCount / questions.length) * 100);
      
      // Insert game attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('game_attempts')
        .insert({
          user_id: user.id,
          unit_id: unitId,
          game_type: 'listening',
          score,
          correct_answers: correctCount,
          total_questions: questions.length,
          time_spent_seconds: timeSpentSeconds,
          completed: true
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Save incorrect answers to dictation table
      const incorrectQuestions = questions.filter(q => !q.isCorrect);
      if (incorrectQuestions.length > 0 && attempt) {
        const incorrectInserts = incorrectQuestions.map(q => ({
          attempt_id: attempt.id,
          incorrect_word: q.word,
          user_answer: q.userAnswer
        }));

        await supabase
          .from('attempt_incorrect_answers_dictation')
          .insert(incorrectInserts);
      }

      // Calculate XP
      const baseXp = Math.round(score * 0.5);
      const avgTimePerQuestion = timeSpentSeconds / questions.length;
      let timeBonus = 0;
      if (avgTimePerQuestion <= 5) timeBonus = 25;
      else if (avgTimePerQuestion < 30) timeBonus = Math.max(0, Math.round(25 - (avgTimePerQuestion - 5)));
      
      const gameXp = baseXp + timeBonus;

      // Update or insert user progress
      const { data: existingProgress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('unit_id', unitId)
        .eq('game_type', 'listening')
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from('user_progress')
          .update({
            attempts: existingProgress.attempts + 1,
            total_time_seconds: existingProgress.total_time_seconds + timeSpentSeconds,
            total_xp: gameXp,
            best_score: Math.max(existingProgress.best_score, score),
            completed: existingProgress.completed || score === 100,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
        await supabase
          .from('user_progress')
          .insert({
            user_id: user.id,
            unit_id: unitId,
            game_type: 'listening',
            best_score: score,
            total_xp: gameXp,
            total_time_seconds: timeSpentSeconds,
            attempts: 1,
            completed: score === 100
          });
      }

      // Update profile XP
      const { data: allProgress } = await supabase
        .from('user_progress')
        .select('total_xp')
        .eq('user_id', user.id);

      const totalXp = allProgress?.reduce((sum, p) => sum + (p.total_xp || 0), 0) || 0;
      const newLevel = Math.floor(totalXp / 100) + 1;

      // Calculate streak
      const today = new Date().toISOString().split('T')[0];
      const { data: profile } = await supabase
        .from('profiles')
        .select('study_streak, last_study_date')
        .eq('user_id', user.id)
        .maybeSingle();

      let newStreak = profile?.study_streak || 0;
      if (profile?.last_study_date !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (profile?.last_study_date === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }

      await supabase
        .from('profiles')
        .update({
          total_xp: totalXp,
          level: newLevel,
          last_study_date: today,
          study_streak: newStreak,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      setEarnedXp(gameXp);
      setTimeout(() => setShowXpAnimation(true), 300);

    } catch (err) {
      console.error('Error saving game attempt:', err);
    } finally {
      setSaving(false);
    }
  };

  const getScore = () => {
    const correct = questions.filter(q => q.isCorrect).length;
    return Math.round((correct / questions.length) * 100);
  };

  const resetGame = () => {
    setCurrentIndex(0);
    setQuestions([]);
    setUserInput("");
    setShowResults(false);
    setShowFeedback(false);
    setCurrentFeedback(null);
    setEarnedXp(0);
    setShowXpAnimation(false);
    startTimeRef.current = Date.now();
    fetchWords();
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
                <h2 className="text-3xl font-bold text-success">Perfect Spelling!</h2>
                <p className="text-lg text-muted-foreground">
                  You spelled every word correctly!
                </p>
                <Badge className="bg-gradient-success text-success-foreground text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🎧</div>
                <h2 className="text-3xl font-bold">Good Listening!</h2>
                <p className="text-lg text-muted-foreground">
                  You got {questions.filter(q => q.isCorrect).length} out of {questions.length} correct.
                </p>
                <Badge variant="outline" className="text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
              </>
            )}

            {/* Results breakdown */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {questions.map((q, i) => (
                <div 
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    q.isCorrect ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {q.isCorrect ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : (
                      <X className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-medium">{q.word}</span>
                  </div>
                  {!q.isCorrect && (
                    <span className="text-sm text-muted-foreground">
                      You typed: "{q.userAnswer}"
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
                ${showXpAnimation ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
              `}
            >
              <Zap className={`h-6 w-6 text-primary ${showXpAnimation ? 'animate-pulse' : ''}`} />
              <span className="text-xl font-bold text-primary">+{earnedXp} XP</span>
              {saving && <span className="text-sm text-muted-foreground">(saving...)</span>}
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="game" onClick={resetGame} size="lg">
                <RotateCcw className="h-5 w-5 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={onBack} size="lg">
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Audio Challenge</h1>
              <p className="text-sm text-muted-foreground">{unitTitle}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onBack}>
            Exit
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Word {currentIndex + 1} of {words.length}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Main Game Card */}
        <Card className="p-8 bg-card/50 backdrop-blur-sm border-2 border-border/50 space-y-6">
          {/* Audio Button */}
          <div className="flex flex-col items-center space-y-4">
            <p className="text-muted-foreground text-center">
              Listen to the word and type what you hear
            </p>
            
            <Button
              onClick={() => playWord(words[currentIndex])}
              disabled={isPlaying}
              variant="hero"
              size="lg"
              className="w-32 h-32 rounded-full"
            >
              {isPlaying ? (
                <Loader2 className="h-12 w-12 animate-spin" />
              ) : (
                <Volume2 className="h-12 w-12" />
              )}
            </Button>
            
            <p className="text-sm text-muted-foreground">
              {isPlaying ? "Playing..." : "Click to play again"}
            </p>
          </div>

          {/* Input Area */}
          {showFeedback && currentFeedback ? (
            <div className={`p-6 rounded-lg text-center ${
              currentFeedback.isCorrect 
                ? 'bg-success/10 border-2 border-success/30' 
                : 'bg-destructive/10 border-2 border-destructive/30'
            }`}>
              <div className="flex items-center justify-center gap-2">
                {currentFeedback.isCorrect ? (
                  <>
                    <Check className="h-8 w-8 text-success" />
                    <span className="text-2xl font-bold text-success">Correct!</span>
                  </>
                ) : (
                  <>
                    <X className="h-8 w-8 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">Try again next time!</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Type the word you hear..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-center text-xl py-6"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              
              <Button
                onClick={handleSubmit}
                disabled={!userInput.trim()}
                variant="game"
                size="lg"
                className="w-full"
              >
                Check Spelling
              </Button>
            </div>
          )}

          {/* Next Button */}
          {showFeedback && (
            <Button
              onClick={handleNext}
              variant="hero"
              size="lg"
              className="w-full"
            >
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
          )}
        </Card>

        {/* Hint */}
        <p className="text-center text-sm text-muted-foreground">
          💡 Listen carefully! You can replay the word as many times as you need.
        </p>
      </div>
    </div>
  );
};
