import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mic, 
  Volume2, 
  RotateCcw,
  Trophy,
  Zap,
  ArrowRight,
  Check,
  X,
  Loader2,
  MicOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface VoiceMasterGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

interface WordQuestion {
  word: string;
  userAnswer: string;
  isCorrect: boolean | null;
  isPriority?: boolean;
}

export const VoiceMasterGame = ({ unitId, unitTitle, onComplete, onBack }: VoiceMasterGameProps) => {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<WordQuestion[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<{ isCorrect: boolean; correctWord: string; userSaid: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const startTimeRef = useRef<number>(Date.now());
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const wordsRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(0);
  const questionsRef = useRef<WordQuestion[]>([]);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    // Check for speech recognition support
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setSpeechSupported(false);
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition. Try Chrome or Edge.",
        variant: "destructive",
      });
    }
    
    fetchWords();
    startTimeRef.current = Date.now();
    
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [unitId]);

  // Keep refs in sync with state
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

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

      const wordList: string[] = Array.isArray(unit.words) 
        ? unit.words 
        : JSON.parse(unit.words as string);
      
      // Fetch previous incorrect answers from last 3 attempts
      let priorityWords: string[] = [];
      if (user) {
        const { data: prevAttempts } = await supabase
          .from('game_attempts')
          .select('id')
          .eq('user_id', user.id)
          .eq('unit_id', unitId)
          .eq('game_type', 'speaking')
          .order('created_at', { ascending: false })
          .limit(3);

        if (prevAttempts && prevAttempts.length > 0) {
          const attemptIds = prevAttempts.map(a => a.id);
          
          const { data: incorrectAnswers } = await supabase
            .from('attempt_incorrect_answers_dictation')
            .select('incorrect_word')
            .in('attempt_id', attemptIds);

          if (incorrectAnswers) {
            const incorrectSet = new Set(incorrectAnswers.map(a => a.incorrect_word.toLowerCase()));
            priorityWords = wordList.filter(word => incorrectSet.has(word.toLowerCase()));
          }
        }
      }

      // Use ALL words from the unit
      const shuffledPriority = [...priorityWords].sort(() => Math.random() - 0.5);
      const remainingWords = wordList.filter(w => !priorityWords.includes(w));
      const shuffledRemaining = [...remainingWords].sort(() => Math.random() - 0.5);
      
      const finalWords = [...shuffledPriority, ...shuffledRemaining];
      
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
    
    synthRef.current.cancel();
    setIsPlaying(true);
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Female')) 
      || voices.find(v => v.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    synthRef.current.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    recognitionRef.current = new SpeechRecognitionAPI();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      handleSpeechResult(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        toast({
          title: "No speech detected",
          description: "Please try speaking again.",
        });
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const handleSpeechResult = useCallback((transcript: string) => {
    const currentWord = wordsRef.current[currentIndexRef.current];
    
    if (!currentWord) {
      console.error('No current word found', { 
        wordsLength: wordsRef.current.length, 
        currentIndex: currentIndexRef.current 
      });
      return;
    }
    
    const isCorrect = transcript.toLowerCase() === currentWord.toLowerCase();
    
    const updatedQuestions = [...questionsRef.current];
    updatedQuestions[currentIndexRef.current] = {
      word: currentWord,
      userAnswer: transcript,
      isCorrect
    };
    setQuestions(updatedQuestions);
    
    setCurrentFeedback({ isCorrect, correctWord: currentWord, userSaid: transcript });
    setShowFeedback(true);
  }, []);

  const handleNext = async () => {
    setShowFeedback(false);
    setCurrentFeedback(null);
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResults(true);
      await saveGameAttempt();
    }
  };

  const saveGameAttempt = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const correctCount = questions.filter(q => q.isCorrect).length;
      const score = Math.round((correctCount / questions.length) * 100);
      
      const { data: attempt, error: attemptError } = await supabase
        .from('game_attempts')
        .insert({
          user_id: user.id,
          unit_id: unitId,
          game_type: 'speaking',
          score,
          correct_answers: correctCount,
          total_questions: questions.length,
          time_spent_seconds: timeSpentSeconds,
          completed: true
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Save incorrect answers to dictation table (reusing same table)
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
        .eq('game_type', 'speaking')
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
            game_type: 'speaking',
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
    setShowResults(false);
    setShowFeedback(false);
    setCurrentFeedback(null);
    setEarnedXp(0);
    setShowXpAnimation(false);
    startTimeRef.current = Date.now();
    fetchWords();
  };

  if (!speechSupported) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <MicOff className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Speech Recognition Not Supported</h2>
            <p className="text-muted-foreground">
              Your browser doesn't support speech recognition. 
              Please try Chrome, Edge, or Safari on a desktop or mobile device.
            </p>
            <Button variant="outline" onClick={onBack} size="lg">
              Back to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

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
                <h2 className="text-3xl font-bold text-success">Perfect Pronunciation!</h2>
                <p className="text-lg text-muted-foreground">
                  You said every word correctly!
                </p>
                <Badge className="bg-gradient-success text-success-foreground text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🎤</div>
                <h2 className="text-3xl font-bold">Great Speaking!</h2>
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
                      You said: "{q.userAnswer}"
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

  const currentWord = words[currentIndex];
  const progressPercent = ((currentIndex) / words.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mic className="h-6 w-6 text-primary" />
              Voice Master
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
        <Card className="p-8 space-y-8 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          {showFeedback && currentFeedback ? (
            // Feedback State
            <div className="text-center space-y-6">
              <div className={`text-6xl ${currentFeedback.isCorrect ? 'animate-bounce' : ''}`}>
                {currentFeedback.isCorrect ? '🎉' : '🤔'}
              </div>
              
              <div className={`p-4 rounded-xl ${
                currentFeedback.isCorrect 
                  ? 'bg-success/10 border-2 border-success/30' 
                  : 'bg-destructive/10 border-2 border-destructive/30'
              }`}>
                {currentFeedback.isCorrect ? (
                  <div className="flex items-center justify-center gap-2 text-success">
                    <Check className="h-6 w-6" />
                    <span className="text-xl font-bold">Perfect!</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-destructive">
                      <X className="h-6 w-6" />
                      <span className="text-xl font-bold">Not quite...</span>
                    </div>
                    <p className="text-muted-foreground">
                      You said: <span className="font-medium">"{currentFeedback.userSaid}"</span>
                    </p>
                    <p className="text-muted-foreground">
                      Correct word: <span className="font-bold text-foreground">{currentFeedback.correctWord}</span>
                    </p>
                  </div>
                )}
              </div>

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
          ) : (
            // Speaking State
            <div className="text-center space-y-8">
              <div className="space-y-4">
                <p className="text-muted-foreground">Say this word:</p>
                <div className="text-4xl font-bold tracking-wide py-6 px-8 bg-muted/30 rounded-xl border-2 border-border/50">
                  {currentWord}
                </div>
              </div>

              {/* Listen Button */}
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => playWord(currentWord)}
                disabled={isPlaying}
                className="gap-2"
              >
                {isPlaying ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
                Listen
              </Button>

              {/* Microphone Button */}
              <div className="relative">
                <Button 
                  onClick={isListening ? stopListening : startListening}
                  variant={isListening ? "destructive" : "game"}
                  size="lg"
                  className={`w-32 h-32 rounded-full ${isListening ? 'animate-pulse' : ''}`}
                >
                  {isListening ? (
                    <div className="flex flex-col items-center gap-2">
                      <Mic className="h-10 w-10" />
                      <span className="text-xs">Listening...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Mic className="h-10 w-10" />
                      <span className="text-xs">Tap to Speak</span>
                    </div>
                  )}
                </Button>
                
                {isListening && (
                  <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-20" />
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Tap the microphone and say the word clearly
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
