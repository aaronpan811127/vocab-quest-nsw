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
}

interface Question {
  options: string[];
  oddOneOut: string;
  oddDefinition: string;
  similarDefinition: string;
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
      const { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('unit_id', unitId);

      if (error) throw error;

      if (!data || data.length < 4) {
        // Need at least 4 words, generate vocabulary if not enough
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('words')
          .eq('id', unitId)
          .single();

        if (unitError) throw unitError;

        const unitWords = unitData.words as string[];
        setGenerating(true);
        
        const { data: genData, error: genError } = await supabase.functions.invoke('generate-vocabulary', {
          body: { unit_id: unitId, words: unitWords }
        });

        if (genError) throw genError;

        if (genData.success && genData.vocabulary) {
          setWords(genData.vocabulary);
          generateQuestions(genData.vocabulary);
        }
      } else {
        setWords(data as Word[]);
        generateQuestions(data as Word[]);
      }
    } catch (err) {
      console.error('Error fetching vocabulary:', err);
      toast({
        title: "Error",
        description: "Failed to load vocabulary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const generateQuestions = (vocabWords: Word[]) => {
    if (vocabWords.length < 4) return;

    const generatedQuestions: Question[] = [];
    const shuffledWords = [...vocabWords].sort(() => Math.random() - 0.5);
    const numQuestions = Math.min(8, Math.floor(vocabWords.length / 2));

    for (let i = 0; i < numQuestions; i++) {
      // Pick 3 similar words (using synonyms if available, otherwise random)
      const baseWord = shuffledWords[i % shuffledWords.length];
      const similarWords: Word[] = [baseWord];
      
      // Find words with similar definitions or shared synonyms
      const otherWords = vocabWords.filter(w => w.id !== baseWord.id);
      const shuffledOthers = [...otherWords].sort(() => Math.random() - 0.5);
      
      // Add 2 more "similar" words
      for (let j = 0; j < Math.min(2, shuffledOthers.length); j++) {
        similarWords.push(shuffledOthers[j]);
      }

      // Pick 1 odd word (different from the group)
      const oddWord = shuffledOthers[2] || shuffledOthers[0];
      
      if (similarWords.length >= 3 && oddWord) {
        const options = [...similarWords.map(w => w.word), oddWord.word].sort(() => Math.random() - 0.5);
        
        generatedQuestions.push({
          options,
          oddOneOut: oddWord.word,
          oddDefinition: oddWord.definition,
          similarDefinition: baseWord.definition,
        });
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

    try {
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
              Back to Dashboard
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
              onTryAgain={() => {
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
                Definition: {currentQ.oddDefinition}
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
