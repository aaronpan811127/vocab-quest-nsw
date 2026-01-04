import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Check, 
  X, 
  Loader2,
  CircleOff,
  Trophy,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { GameResultActions } from "./GameResultActions";

interface Word {
  id: string;
  word: string;
  definition: string;
  synonyms: string[];
  antonyms: string[];
}

interface Question {
  options: string[];
  oddOneOut: string;
  explanation: string;
  baseWord: string;
}

interface OddOneOutGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

export const OddOneOutGame = ({ unitId, unitTitle, onComplete, onBack }: OddOneOutGameProps) => {
  const [words, setWords] = useState<Word[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [startTime] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchVocabulary();
  }, [unitId]);

  const fetchVocabulary = async () => {
    setLoading(true);
    try {
      // First check if vocabulary exists
      let { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('unit_id', unitId);

      if (error) throw error;

      // If no vocabulary or not enough, generate it
      if (!data || data.length < 4) {
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('words')
          .eq('id', unitId)
          .single();

        if (unitError) throw unitError;

        const unitWords = unitData.words as string[];
        
        if (unitWords.length < 4) {
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
        
        const { data: genData, error: genError } = await supabase.functions.invoke('generate-vocabulary', {
          body: { unit_id: unitId, words: unitWords }
        });

        if (genError) {
          console.error('Generation error:', genError);
          throw new Error('Failed to generate vocabulary');
        }

        if (genData?.success && genData.vocabulary) {
          // Re-fetch from database to ensure consistency
          const { data: freshData, error: freshError } = await supabase
            .from('vocabulary')
            .select('*')
            .eq('unit_id', unitId);
          
          if (freshError) throw freshError;
          
          data = freshData;
        } else {
          throw new Error(genData?.error || 'Failed to generate vocabulary');
        }
      }

      if (!data || data.length < 4) {
        toast({
          title: "Vocabulary generation failed",
          description: "Please try playing Flashcards first to generate vocabulary.",
          variant: "destructive",
        });
        return;
      }

      setWords(data as Word[]);
      generateQuestions(data as Word[]);
    } catch (err) {
      console.error('Error fetching vocabulary:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load vocabulary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const generateQuestions = (vocabWords: Word[]) => {
    const generatedQuestions: Question[] = [];
    
    // Filter words that have synonyms and antonyms
    const wordsWithAntonyms = vocabWords.filter(
      w => w.synonyms?.length >= 2 && w.antonyms?.length >= 1
    );
    
    const wordsWithSynonyms = vocabWords.filter(w => w.synonyms?.length >= 2);
    
    // Shuffle and create questions - use all available words
    const shuffled = [...wordsWithAntonyms].sort(() => Math.random() - 0.5);
    const numQuestions = Math.max(shuffled.length, wordsWithSynonyms.length);
    
    // Strategy 1: Use base word + 2 synonyms + 1 antonym (antonym is odd)
    for (let i = 0; i < Math.min(shuffled.length, numQuestions); i++) {
      const word = shuffled[i];
      
      // Get 2 synonyms
      const synonyms = [...word.synonyms].sort(() => Math.random() - 0.5).slice(0, 2);
      
      // Get 1 antonym as the odd one out
      const oddWord = word.antonyms[Math.floor(Math.random() * word.antonyms.length)];
      
      if (synonyms.length === 2 && oddWord) {
        // Include the base word + 2 synonyms + 1 antonym
        const options = [word.word, ...synonyms, oddWord].sort(() => Math.random() - 0.5);
        
        generatedQuestions.push({
          options,
          oddOneOut: oddWord,
          explanation: `"${oddWord}" is an antonym (opposite meaning) of "${word.word}", while "${synonyms.join('", "')}" are synonyms.`,
          baseWord: word.word,
        });
      }
    }
    
    // Strategy 2: If we need more questions, use word + synonyms vs unrelated word
    if (generatedQuestions.length < numQuestions && wordsWithSynonyms.length >= 2) {
      const remainingNeeded = numQuestions - generatedQuestions.length;
      const shuffledSynWords = [...wordsWithSynonyms].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(remainingNeeded, shuffledSynWords.length - 1); i++) {
        const word1 = shuffledSynWords[i];
        const word2 = shuffledSynWords.find(w => 
          w.id !== word1.id && 
          !word1.synonyms.some(s => w.synonyms?.includes(s))
        );
        
        if (!word2) continue;
        
        // Get 2 synonyms from word1
        const synonyms = [...word1.synonyms].sort(() => Math.random() - 0.5).slice(0, 2);
        
        // Use word2 as the odd one (different meaning entirely)
        const oddWord = word2.word;
        
        if (synonyms.length === 2) {
          // word1 + 2 synonyms of word1 + word2 (odd)
          const options = [word1.word, ...synonyms, oddWord].sort(() => Math.random() - 0.5);
          
          generatedQuestions.push({
            options,
            oddOneOut: oddWord,
            explanation: `"${oddWord}" means "${word2.definition.slice(0, 50)}...", while the others relate to "${word1.word}".`,
            baseWord: word1.word,
          });
        }
      }
    }
    
    // Fallback: use any words with at least 1 antonym
    if (generatedQuestions.length < 4) {
      const anyWords = vocabWords.filter(w => w.antonyms?.length >= 1);
      const shuffledAny = [...anyWords].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < shuffledAny.length && generatedQuestions.length < 4; i++) {
        const word = shuffledAny[i];
        const synonyms = (word.synonyms || []).slice(0, 2);
        const oddWord = word.antonyms[0];
        
        if (oddWord) {
          const options = [word.word, ...synonyms, oddWord].filter(Boolean).slice(0, 4);
          if (options.length === 4) {
            generatedQuestions.push({
              options: options.sort(() => Math.random() - 0.5),
              oddOneOut: oddWord,
              explanation: `"${oddWord}" is the opposite of "${word.word}".`,
              baseWord: word.word,
            });
          }
        }
      }
    }
    
    setQuestions(generatedQuestions);
  };

  const handleSelect = (word: string) => {
    if (showResult) return;
    setSelectedAnswer(word);
  };

  const handleConfirm = () => {
    if (!selectedAnswer) return;
    
    const isCorrect = selectedAnswer === questions[currentQuestion].oddOneOut;
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
    }
    setShowResult(true);
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setSaving(true);
      await saveGameAttempt();
      setShowCompletion(true);
    }
  };

  const saveGameAttempt = async () => {
    if (!user) return;

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const score = Math.round((correctAnswers / questions.length) * 100);
    const isPerfect = correctAnswers === questions.length;

    try {
      // Save game attempt
      const { error } = await supabase
        .from('game_attempts')
        .insert({
          user_id: user.id,
          unit_id: unitId,
          game_type: 'oddoneout',
          score,
          correct_answers: correctAnswers,
          total_questions: questions.length,
          time_spent_seconds: timeSpent,
          completed: true,
        });

      if (error) throw error;

      // Save/update user_progress for completion tracking
      const { data: existingProgress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('unit_id', unitId)
        .eq('game_type', 'oddoneout')
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from('user_progress')
          .update({
            completed: existingProgress.completed || isPerfect,
            attempts: (existingProgress.attempts || 0) + 1,
            total_time_seconds: (existingProgress.total_time_seconds || 0) + timeSpent,
            best_score: Math.max(existingProgress.best_score || 0, score),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
        await supabase
          .from('user_progress')
          .insert({
            user_id: user.id,
            unit_id: unitId,
            game_type: 'oddoneout',
            completed: isPerfect,
            attempts: 1,
            total_time_seconds: timeSpent,
            best_score: score
          });
      }
    } catch (err) {
      console.error('Error saving game attempt:', err);
    }
  };

  const score = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0;
  const timeSpent = Math.floor((Date.now() - startTime) / 1000);

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

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <CircleOff className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Not enough vocabulary</h2>
            <p className="text-muted-foreground">
              This unit needs more words to play. Try another unit or add more vocabulary.
            </p>
            <Button variant="outline" onClick={onBack} size="lg">
              Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (showCompletion) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto" />
            <h2 className="text-3xl font-bold text-primary">Game Complete!</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-3xl font-bold text-primary">{score}%</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{correctAnswers}/{questions.length}</p>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Time: {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}</span>
            </div>
            <GameResultActions 
              onPlayAgain={() => {
                setCurrentQuestion(0);
                setSelectedAnswer(null);
                setShowResult(false);
                setCorrectAnswers(0);
                setShowCompletion(false);
                generateQuestions(words);
              }} 
              onBack={onComplete} 
              hasMistakes={correctAnswers < questions.length}
            />
          </Card>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <CircleOff className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="truncate">Odd One Out</span>
            </h1>
            <p className="text-sm text-muted-foreground truncate">{unitTitle}</p>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{correctAnswers} correct</span>
          </div>
          <Progress value={((currentQuestion + 1) / questions.length) * 100} className="h-2" />
        </div>

        {/* Question */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          <h2 className="text-lg sm:text-xl font-semibold text-center mb-6">
            Which word has a <span className="text-primary">different meaning</span>?
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {currentQ.options.map((word, index) => {
              const isSelected = selectedAnswer === word;
              const isCorrect = word === currentQ.oddOneOut;
              const showCorrect = showResult && isCorrect;
              const showWrong = showResult && isSelected && !isCorrect;

              return (
                <Button
                  key={index}
                  variant={isSelected ? "default" : "outline"}
                  className={`
                    h-auto py-4 px-4 text-base sm:text-lg font-medium transition-all
                    ${showCorrect ? 'bg-green-500 hover:bg-green-500 border-green-500 text-white' : ''}
                    ${showWrong ? 'bg-red-500 hover:bg-red-500 border-red-500 text-white' : ''}
                    ${isSelected && !showResult ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                  onClick={() => handleSelect(word)}
                  disabled={showResult}
                >
                  {showCorrect && <Check className="h-4 w-4 mr-2" />}
                  {showWrong && <X className="h-4 w-4 mr-2" />}
                  {word}
                </Button>
              );
            })}
          </div>

          {showResult && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="font-medium">
                <span className="text-primary">{currentQ.oddOneOut}</span> is the odd one out!
              </p>
              <p className="text-sm text-muted-foreground">
                {currentQ.explanation}
              </p>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-center">
          {!showResult ? (
            <Button 
              variant="hero" 
              onClick={handleConfirm}
              disabled={!selectedAnswer}
              size="lg"
              className="min-w-[150px]"
            >
              Confirm
            </Button>
          ) : (
            <Button 
              variant="hero" 
              onClick={handleNext}
              size="lg"
              className="min-w-[150px]"
            >
              {currentQuestion < questions.length - 1 ? 'Next' : 'See Results'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
