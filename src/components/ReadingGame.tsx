import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  RotateCcw,
  Trophy
} from "lucide-react";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface ReadingGameProps {
  onComplete: () => void;
  onBack: () => void;
}

export const ReadingGame = ({ onComplete, onBack }: ReadingGameProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);

  // Demo passage and questions for Unit 2: Academic Excellence
  const passage = `
    The phenomenon of technological advancement has been particularly **profound** in recent decades. 
    Scientists and engineers have demonstrated remarkable **ingenuity** in developing solutions to complex problems. 
    Their **meticulous** research methods ensure that innovations are both reliable and effective. 
    The **comprehensive** nature of modern education has enabled students to become more **adept** at utilizing these technologies. 
    However, some critics argue that this rapid progress has led to **complacency** among younger generations, 
    who may lack the **tenacity** required for in-depth study. Nevertheless, the **prevalent** use of digital tools 
    has made learning more accessible, helping students **discern** important information more efficiently. 
    This **cohesive** integration of technology and education continues to shape our future.
  `;

  const questions: Question[] = [
    {
      id: 1,
      question: "What does 'profound' mean in the context of technological advancement?",
      options: ["Shallow", "Deep and significant", "Quick", "Expensive"],
      correctAnswer: 1
    },
    {
      id: 2,
      question: "The word 'ingenuity' refers to:",
      options: ["Laziness", "Creativity and cleverness", "Confusion", "Anger"],
      correctAnswer: 1
    },
    {
      id: 3,
      question: "What does 'meticulous' describe about research methods?",
      options: ["Careless", "Very careful and precise", "Fast", "Boring"],
      correctAnswer: 1
    },
    {
      id: 4,
      question: "When someone is 'adept' at something, they are:",
      options: ["Bad at it", "Confused by it", "Skilled at it", "Afraid of it"],
      correctAnswer: 2
    },
    {
      id: 5,
      question: "What does 'complacency' suggest about younger generations?",
      options: ["They are very active", "They are overly satisfied and less motivated", "They are angry", "They are helpful"],
      correctAnswer: 1
    }
  ];

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
      checkGameCompletion();
    }
  };

  const checkGameCompletion = () => {
    const correctAnswers = selectedAnswers.filter((answer, index) => 
      answer === questions[index].correctAnswer
    ).length;
    
    if (correctAnswers === questions.length) {
      setGameCompleted(true);
    }
  };

  const getScore = () => {
    const correctAnswers = selectedAnswers.filter((answer, index) => 
      answer === questions[index].correctAnswer
    ).length;
    return Math.round((correctAnswers / questions.length) * 100);
  };

  const resetGame = () => {
    setCurrentQuestion(0);
    setSelectedAnswers([]);
    setShowResults(false);
    setGameCompleted(false);
  };

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
                  You got {selectedAnswers.filter((answer, index) => answer === questions[index].correctAnswer).length} out of {questions.length} correct.
                </p>
                <Badge variant="outline" className="text-lg px-6 py-2">
                  Score: {score}%
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Don't worry! A new passage with your missed words will be generated for more practice.
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
              Unit 2: Academic Excellence
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
            Reading Passage
          </h3>
          <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
            {passage.split('**').map((part, index) => 
              index % 2 === 0 ? (
                <span key={index}>{part}</span>
              ) : (
                <strong key={index} className="text-primary font-bold bg-primary/10 px-1 rounded">
                  {part}
                </strong>
              )
            )}
          </div>
        </Card>

        {/* Question */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
          <h3 className="text-lg font-semibold mb-4">
            {questions[currentQuestion].question}
          </h3>
          <div className="space-y-3">
            {questions[currentQuestion].options.map((option, index) => (
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