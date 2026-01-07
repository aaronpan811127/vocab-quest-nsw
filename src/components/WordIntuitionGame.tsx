import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ThumbsUp, ThumbsDown, Minus, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { GameResultActions } from "./GameResultActions";

interface WordIntuitionGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

interface Question {
  id: string;
  word: string;
  sentence: string;
  correctAnswer: string;
  explanation: string;
}

export const WordIntuitionGame = ({ unitId, unitTitle, onComplete, onBack }: WordIntuitionGameProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]); // Store all questions for "Play Again"
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [incorrectAnswers, setIncorrectAnswers] = useState<Array<{ questionId: string; userAnswer: string }>>([]);

  useEffect(() => {
    loadQuestions();
  }, [unitId]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      // First, try to fetch existing questions from question_bank
      const intuitionGameId = '05155f78-2977-44cd-8d77-b6ec5a7b78cc';
      const { data: existingQuestions, error: fetchError } = await supabase
        .from("question_bank")
        .select("*")
        .eq("unit_id", unitId)
        .eq("game_id", intuitionGameId);

      if (fetchError) {
        console.error("Error fetching questions:", fetchError);
      }

      if (existingQuestions && existingQuestions.length >= 5) {
        // Use existing questions
        const formattedQuestions = existingQuestions.map((q) => {
          const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
          return {
            id: q.id,
            word: options.word,
            sentence: q.question_text,
            correctAnswer: q.correct_answer,
            explanation: options.explanation,
          };
        });
        const shuffled = shuffleArray(formattedQuestions).slice(0, 10);
        setAllQuestions(shuffled);
        setQuestions(shuffled);
        setStartTime(Date.now());
      } else {
        // Generate new questions using AI
        await generateQuestions();
      }
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuestions = async () => {
    setIsGenerating(true);
    try {
      // First get vocabulary words for this unit
      let { data: vocabulary, error: vocabError } = await supabase
        .from("vocabulary")
        .select("word")
        .eq("unit_id", unitId);

      if (vocabError) throw vocabError;

      let words: string[] = [];

      if (vocabulary && vocabulary.length > 0) {
        words = vocabulary.map((v) => v.word);
      } else {
        // Get words from unit and generate vocabulary
        const { data: unit, error: unitError } = await supabase
          .from("units")
          .select("words")
          .eq("id", unitId)
          .single();

        if (unitError) throw unitError;

        if (unit?.words && Array.isArray(unit.words)) {
          const unitWords = unit.words as string[];
          
          // Generate vocabulary using AI
          toast({
            title: "Generating vocabulary...",
            description: "Creating definitions and examples for words.",
          });
          
          const { data: genData, error: genError } = await supabase.functions.invoke('generate-vocabulary', {
            body: { unit_id: unitId, words: unitWords }
          });

          if (genError) {
            console.error('Error generating vocabulary:', genError);
            // Fallback to unit words without generated vocabulary
            words = unitWords;
          } else if (genData?.success && genData.vocabulary) {
            words = genData.vocabulary.map((v: { word: string }) => v.word);
          } else {
            words = unitWords;
          }
        }
      }

      if (words.length === 0) {
        toast({
          title: "No words available",
          description: "This unit has no vocabulary words to practice.",
          variant: "destructive",
        });
        return;
      }

      // Generate intuition questions via edge function
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-intuition-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            unit_id: unitId,
            words: words.slice(0, 10),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate questions");
      }

      const result = await response.json();

      if (result.questions && result.questions.length > 0) {
        const formattedQuestions: Question[] = result.questions.map((q: any) => {
          const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
          return {
            id: q.id,
            word: options.word,
            sentence: q.question_text,
            correctAnswer: q.correct_answer,
            explanation: options.explanation,
          };
        });
        const shuffled = shuffleArray(formattedQuestions).slice(0, 10);
        setAllQuestions(shuffled);
        setQuestions(shuffled);
        setStartTime(Date.now());
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate questions.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleAnswer = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
    setShowResult(true);

    const currentQuestion = questions[currentIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
    } else {
      setIncorrectAnswers((prev) => [
        ...prev,
        { questionId: currentQuestion.id, userAnswer: answer },
      ]);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      handleGameComplete();
    }
  };

  const handleGameComplete = async () => {
    setGameComplete(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const finalScore = Math.round((score / questions.length) * 100);

    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke("submit-intuition-game", {
        body: {
          unit_id: unitId,
          score: finalScore,
          correct_answers: score,
          total_questions: questions.length,
          time_spent_seconds: timeSpent,
          incorrect_answers: incorrectAnswers,
        },
      });

      if (error) throw error;
      // No toast notification for practice games
    } catch (error) {
      console.error("Error saving game:", error);
    }
  };

  const handleTryAgain = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setGameComplete(false);
    setIncorrectAnswers([]);
    setQuestions(shuffleArray([...allQuestions])); // Use all questions for "Play Again"
    setStartTime(Date.now());
  };

  const handlePracticeMistakes = () => {
    // Filter questions to only include ones that were answered incorrectly
    const mistakeQuestionIds = incorrectAnswers.map((a) => a.questionId);
    const mistakeQuestions = allQuestions.filter((q) => mistakeQuestionIds.includes(q.id));
    
    if (mistakeQuestions.length === 0) return;
    
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setGameComplete(false);
    setIncorrectAnswers([]);
    setQuestions(shuffleArray(mistakeQuestions));
    setStartTime(Date.now());
  };

  const getAnswerIcon = (answer: string) => {
    switch (answer) {
      case "positive":
        return <ThumbsUp className="h-5 w-5" />;
      case "negative":
        return <ThumbsDown className="h-5 w-5" />;
      case "neutral":
        return <Minus className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getAnswerColor = (answer: string, isSelected: boolean, isCorrect: boolean) => {
    if (!showResult) {
      return isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50";
    }

    if (answer === questions[currentIndex]?.correctAnswer) {
      return "border-green-500 bg-green-500/10";
    }

    if (isSelected && !isCorrect) {
      return "border-red-500 bg-red-500/10";
    }

    return "border-border opacity-50";
  };

  if (isLoading || isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">
              {isGenerating ? "Generating questions..." : "Loading game..."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">No questions available</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Unable to generate questions for this unit.
            </p>
            <Button onClick={onBack}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameComplete) {
    const finalScore = Math.round((score / questions.length) * 100);

    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Game Complete! 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">{finalScore}%</div>
              <p className="text-muted-foreground">
                {score} out of {questions.length} correct
              </p>
            </div>

            <div className="flex justify-center gap-2">
              {finalScore >= 80 ? (
                <span className="text-4xl">🌟</span>
              ) : finalScore >= 60 ? (
                <span className="text-4xl">👍</span>
              ) : (
                <span className="text-4xl">💪</span>
              )}
            </div>

            <GameResultActions
              onBack={onComplete}
              onPlayAgain={handleTryAgain}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Highlight the word in the sentence
  const highlightWord = (sentence: string, word: string) => {
    const regex = new RegExp(`(${word})`, "gi");
    const parts = sentence.split(regex);
    return parts.map((part, index) =>
      part.toLowerCase() === word.toLowerCase() ? (
        <span key={index} className="font-bold text-primary underline decoration-2 underline-offset-2">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-6 w-6 text-primary" />
            <h1 className="text-lg sm:text-2xl font-bold">Word Intuition</h1>
            <Badge className="bg-gradient-primary text-primary-foreground hidden sm:inline-flex">
              {unitTitle}
            </Badge>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
            Back
          </Button>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-2" />

        {/* Score */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Question {currentIndex + 1} of {questions.length}</span>
          <span className="font-medium text-primary">Score: {score}/{currentIndex + (showResult ? 1 : 0)}</span>
        </div>

        {/* Question Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Lightbulb className="h-5 w-5" />
              <span className="font-medium">Word Intuition</span>
            </div>
            <CardTitle className="text-lg leading-relaxed">
              {highlightWord(currentQuestion.sentence, currentQuestion.word)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-center text-muted-foreground font-medium">
              Does the highlighted word feel positive, negative, or neutral in this context?
            </p>

            {/* Answer Options */}
            <div className="grid grid-cols-3 gap-3">
              {["positive", "negative", "neutral"].map((answer) => {
                const isSelected = selectedAnswer === answer;
                const isCorrect = answer === currentQuestion.correctAnswer;

                return (
                  <button
                    key={answer}
                    onClick={() => handleAnswer(answer)}
                    disabled={showResult}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                      ${getAnswerColor(answer, isSelected, isCorrect)}
                      ${!showResult && "cursor-pointer hover:scale-105"}
                      ${showResult && "cursor-default"}
                    `}
                  >
                    {getAnswerIcon(answer)}
                    <span className="capitalize font-medium">{answer}</span>
                    {showResult && isCorrect && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {showResult && (
              <div className={`p-4 rounded-lg ${
                selectedAnswer === currentQuestion.correctAnswer
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}>
                <div className="flex items-start gap-2">
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium mb-1">
                      {selectedAnswer === currentQuestion.correctAnswer ? "Correct!" : "Not quite!"}
                    </p>
                    <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Button */}
            {showResult && (
              <Button onClick={handleNext} className="w-full" size="lg">
                {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
