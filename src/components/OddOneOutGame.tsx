import { useState, useEffect, useRef } from "react";
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
import { useCelebration } from "@/hooks/useCelebration";

interface Word {
  id: string;
  word: string;
  definition: string;
  synonyms: string[];
  antonyms: string[];
}

interface Question {
  id?: string; // question_bank id if stored
  options: string[];
  oddOneOut: string;
  explanation: string;
  baseWord: string;
}

interface StoredQuestion {
  id: string;
  word: string;
  question_text: string;
  correct_answer: string;
  options: string[];
}

interface OddOneOutGameProps {
  unitId: string;
  unitTitle: string;
  gameId?: string;
  onComplete: () => void;
  onBack: () => void;
}

const QUESTIONS_PER_WORD = 10;
const ODD_ONE_OUT_GAME_ID = 'bb7a0b79-7b92-41df-96b3-c985b07dcd83';

export const OddOneOutGame = ({ unitId, unitTitle, gameId, onComplete, onBack }: OddOneOutGameProps) => {
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
  const [resolvedGameId, setResolvedGameId] = useState<string | null>(gameId || ODD_ONE_OUT_GAME_ID);
  const { user } = useAuth();
  const { toast } = useToast();
  const { celebrate } = useCelebration();
  const hasCelebrated = useRef(false);

  useEffect(() => {
    const resolveGameId = async () => {
      if (!gameId) {
        const { data } = await supabase.from('games').select('id').eq('game_type', 'oddoneout').single();
        if (data) setResolvedGameId(data.id);
      }
    };
    resolveGameId();
  }, [gameId]);

  useEffect(() => {
    fetchVocabularyAndQuestions();
  }, [unitId]);

  // Trigger celebration when showing completion
  useEffect(() => {
    if (showCompletion && !hasCelebrated.current) {
      hasCelebrated.current = true;
      celebrate({
        score: correctAnswers,
        totalQuestions: questions.length,
        gameName: 'Odd One Out'
      });
    }
  }, [showCompletion, correctAnswers, questions.length, celebrate]);

  const fetchVocabularyAndQuestions = async () => {
    setLoading(true);
    try {
      // First check if vocabulary exists
      let { data: vocabData, error } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('unit_id', unitId);

      if (error) throw error;

      // If no vocabulary or not enough, generate it
      if (!vocabData || vocabData.length < 4) {
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
          
          vocabData = freshData;
        } else {
          throw new Error(genData?.error || 'Failed to generate vocabulary');
        }
      }

      if (!vocabData || vocabData.length < 4) {
        toast({
          title: "Vocabulary generation failed",
          description: "Please try playing Flashcards first to generate vocabulary.",
          variant: "destructive",
        });
        return;
      }

      setWords(vocabData as Word[]);
      
      // Now fetch existing questions from question_bank
      await loadOrGenerateQuestions(vocabData as Word[]);
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

  const loadOrGenerateQuestions = async (vocabWords: Word[]) => {
    const gameIdToUse = resolvedGameId || ODD_ONE_OUT_GAME_ID;
    
    // Fetch existing questions for this unit and game
    const { data: existingQuestions, error } = await supabase
      .from('question_bank')
      .select('*')
      .eq('unit_id', unitId)
      .eq('game_id', gameIdToUse);

    if (error) {
      console.error('Error fetching existing questions:', error);
    }

    // Group existing questions by word
    const questionsByWord: Record<string, StoredQuestion[]> = {};
    (existingQuestions || []).forEach(q => {
      if (q.word) {
        if (!questionsByWord[q.word]) {
          questionsByWord[q.word] = [];
        }
        questionsByWord[q.word].push({
          id: q.id,
          word: q.word,
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          options: (q.options as string[]) || []
        });
      }
    });

    // Determine which words need more questions
    const wordsNeedingQuestions: Word[] = [];
    const wordsWithEnoughQuestions: Word[] = [];

    vocabWords.forEach(word => {
      const existingCount = questionsByWord[word.word]?.length || 0;
      if (existingCount < QUESTIONS_PER_WORD) {
        wordsNeedingQuestions.push(word);
      } else {
        wordsWithEnoughQuestions.push(word);
      }
    });

    // Generate new questions for words that need them
    let newlyGeneratedQuestions: Question[] = [];
    if (wordsNeedingQuestions.length > 0) {
      newlyGeneratedQuestions = generateQuestionsForWords(vocabWords, wordsNeedingQuestions, questionsByWord);
      
      // Store newly generated questions in question_bank
      if (newlyGeneratedQuestions.length > 0) {
        await storeQuestionsInBank(newlyGeneratedQuestions, gameIdToUse);
      }
    }

    // Select questions for gameplay (10 total)
    const gameQuestions = selectQuestionsForGame(vocabWords, questionsByWord, newlyGeneratedQuestions);
    setQuestions(gameQuestions);
  };

  const generateQuestionsForWords = (
    allVocabWords: Word[], 
    wordsToGenerate: Word[],
    existingQuestionsByWord: Record<string, StoredQuestion[]>
  ): Question[] => {
    const generatedQuestions: Question[] = [];
    
    // Get all unit words for fallback options
    const getRandomUnitWords = (excludeWords: string[], count: number): string[] => {
      const available = allVocabWords
        .map(w => w.word)
        .filter(w => !excludeWords.map(e => e.toLowerCase()).includes(w.toLowerCase()));
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };
    
    for (const word of wordsToGenerate) {
      const existingCount = existingQuestionsByWord[word.word]?.length || 0;
      const neededCount = QUESTIONS_PER_WORD - existingCount;
      
      for (let i = 0; i < neededCount; i++) {
        // Strategy 1: Use antonym as odd one out
        if (word.antonyms?.length >= 1) {
          const oddWord = word.antonyms[Math.floor(Math.random() * word.antonyms.length)];
          const availableSynonyms = (word.synonyms || []).slice(0, 2);
          
          const relatedCount = 3;
          const currentRelated = 1 + availableSynonyms.length;
          const neededFillers = Math.max(0, relatedCount - currentRelated);
          const fillerWords = neededFillers > 0 
            ? getRandomUnitWords([word.word, ...availableSynonyms, oddWord], neededFillers)
            : [];
          
          const relatedWords = [word.word, ...availableSynonyms, ...fillerWords].slice(0, 3);
          const allOptions = [...relatedWords, oddWord];
          
          if (allOptions.length === 4) {
            const finalOptions = allOptions.sort(() => Math.random() - 0.5);
            generatedQuestions.push({
              options: finalOptions,
              oddOneOut: oddWord,
              explanation: `"${oddWord}" is an antonym (opposite meaning) of "${word.word}", while the others are related words.`,
              baseWord: word.word,
            });
          }
        }
        // Strategy 2: Use unrelated word as odd one out
        else if (word.synonyms?.length >= 1) {
          const unrelatedWord = allVocabWords.find(w => 
            w.id !== word.id && 
            !word.synonyms.some(s => s.toLowerCase() === w.word.toLowerCase()) &&
            !word.antonyms?.some(a => a.toLowerCase() === w.word.toLowerCase())
          );
          
          if (unrelatedWord) {
            const oddWord = unrelatedWord.word;
            const availableSynonyms = (word.synonyms || []).slice(0, 2);
            
            const relatedCount = 3;
            const currentRelated = 1 + availableSynonyms.length;
            const neededFillers = Math.max(0, relatedCount - currentRelated);
            const fillerWords = neededFillers > 0
              ? getRandomUnitWords([word.word, ...availableSynonyms, oddWord], neededFillers)
              : [];
            
            const relatedWords = [word.word, ...availableSynonyms, ...fillerWords].slice(0, 3);
            const allOptions = [...relatedWords, oddWord];
            
            if (allOptions.length === 4) {
              const finalOptions = allOptions.sort(() => Math.random() - 0.5);
              generatedQuestions.push({
                options: finalOptions,
                oddOneOut: oddWord,
                explanation: `"${oddWord}" means "${unrelatedWord.definition.slice(0, 50)}...", while the others relate to "${word.word}".`,
                baseWord: word.word,
              });
            }
          }
        }
      }
    }
    
    return generatedQuestions;
  };

  const storeQuestionsInBank = async (questions: Question[], gameId: string) => {
    const questionsToInsert = questions.map(q => ({
      unit_id: unitId,
      game_id: gameId,
      word: q.baseWord,
      question_text: q.explanation,
      correct_answer: q.oddOneOut,
      options: q.options
    }));

    const { error } = await supabase
      .from('question_bank')
      .insert(questionsToInsert);

    if (error) {
      console.error('Error storing questions:', error);
    }
  };

  const selectQuestionsForGame = (
    vocabWords: Word[],
    existingQuestionsByWord: Record<string, StoredQuestion[]>,
    newlyGeneratedQuestions: Question[]
  ): Question[] => {
    const selectedQuestions: Question[] = [];
    
    // First, add newly generated questions (up to 10)
    const shuffledNewQuestions = [...newlyGeneratedQuestions].sort(() => Math.random() - 0.5);
    selectedQuestions.push(...shuffledNewQuestions.slice(0, 10));
    
    // If we need more, pick randomly from existing stored questions
    if (selectedQuestions.length < 10) {
      const allStoredQuestions: StoredQuestion[] = [];
      Object.values(existingQuestionsByWord).forEach(questions => {
        allStoredQuestions.push(...questions);
      });
      
      const shuffledStored = [...allStoredQuestions].sort(() => Math.random() - 0.5);
      const needed = 10 - selectedQuestions.length;
      
      for (let i = 0; i < needed && i < shuffledStored.length; i++) {
        const sq = shuffledStored[i];
        // Find the vocabulary word to get definition for explanation
        const vocabWord = vocabWords.find(w => w.word === sq.word);
        
        selectedQuestions.push({
          id: sq.id,
          options: sq.options,
          oddOneOut: sq.correct_answer,
          explanation: sq.question_text,
          baseWord: sq.word
        });
      }
    }
    
    // Shuffle final selection and limit to 10
    return selectedQuestions.sort(() => Math.random() - 0.5).slice(0, 10);
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

    if (!resolvedGameId) return;

    try {
      // Save game attempt
      const { error } = await supabase
        .from('game_attempts')
        .insert({
          user_id: user.id,
          unit_id: unitId,
          game_id: resolvedGameId,
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
        .eq('game_id', resolvedGameId)
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
            game_id: resolvedGameId,
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
                hasCelebrated.current = false;
                loadOrGenerateQuestions(words);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleOff className="h-6 w-6 text-primary" />
            <h1 className="text-lg sm:text-2xl font-bold">Odd One Out</h1>
            <Badge className="bg-gradient-primary text-primary-foreground hidden sm:inline-flex">
              {unitTitle}
            </Badge>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
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
          <p className="text-xs text-muted-foreground text-center bg-primary/10 rounded-lg py-2 px-3">
            🎯 <span className="font-semibold">Goal: Answer all {questions.length} questions correctly!</span> Find the word with a different meaning.
          </p>
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
