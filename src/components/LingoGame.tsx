import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  LayoutGrid,
  Delete,
  CornerDownLeft,
  SkipForward,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCelebration } from "@/hooks/useCelebration";
import { useGameTimer } from "@/hooks/useGameTimer";
import { GameTimer } from "@/components/GameTimer";
import { GameResultActions } from "@/components/GameResultActions";

interface LingoGameProps {
  unitId: string;
  unitTitle: string;
  unitWords: string[];
  gameId?: string;
  onComplete: () => void;
  onBack: () => void;
}

type LetterStatus = "correct" | "present" | "absent" | "empty" | "tbd";

interface LetterCell {
  letter: string;
  status: LetterStatus;
}

const MAX_GUESSES = 6;
const WORDS_PER_ROUND = 5;
const SECONDS_PER_WORD = 60;

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

export const LingoGame = ({
  unitId,
  unitTitle,
  unitWords,
  gameId,
  onComplete,
  onBack,
}: LingoGameProps) => {
  const [loading, setLoading] = useState(true);
  const [resolvedGameId, setResolvedGameId] = useState<string | null>(gameId || null);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [guesses, setGuesses] = useState<LetterCell[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [currentRow, setCurrentRow] = useState(0);
  const [wordSolved, setWordSolved] = useState(false);
  const [wordFailed, setWordFailed] = useState(false);
  const [usedLetters, setUsedLetters] = useState<Record<string, LetterStatus>>({});
  const [showCompletion, setShowCompletion] = useState(false);
  const [results, setResults] = useState<{ word: string; solved: boolean; attempts: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(Date.now());
  const [earnedXp, setEarnedXp] = useState(0);
  const [shakeRow, setShakeRow] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);

  const targetWord = targetWords[currentWordIndex] || "";
  const wordLength = targetWord.length;

  const { user } = useAuth();
  const { toast } = useToast();
  const { celebrate } = useCelebration();
  const hasCelebrated = useRef(false);

  const handleTimeUp = useCallback(() => {
    if (!showCompletion) {
      const remaining = targetWords.slice(results.length + (wordSolved || wordFailed ? 1 : 0));
      const failedRemaining = remaining.map(w => ({ word: w, solved: false, attempts: 0 }));
      if (!wordSolved && !wordFailed && targetWord) {
        failedRemaining.unshift({ word: targetWord, solved: false, attempts: currentRow + 1 });
      }
      setResults(prev => [...prev, ...failedRemaining]);
      finishGame();
    }
  }, [showCompletion, targetWords, results, wordSolved, wordFailed, targetWord, currentRow]);

  const {
    formattedTime,
    percentage,
    timerColor,
    progressColor,
    isExpired,
  } = useGameTimer({
    totalQuestions: WORDS_PER_ROUND,
    secondsPerQuestion: SECONDS_PER_WORD,
    onTimeUp: handleTimeUp,
    isActive: !loading && !showCompletion && targetWords.length > 0,
  });
  // Resolve game ID
  useEffect(() => {
    const resolve = async () => {
      if (!gameId) {
        const { data } = await supabase
          .from("games")
          .select("id")
          .eq("game_type", "lingo")
          .single();
        if (data) setResolvedGameId(data.id);
      }
    };
    resolve();
  }, [gameId]);

  // Initialize game
  useEffect(() => {
    if (unitWords.length === 0) {
      toast({ title: "No words available", variant: "destructive" });
      return;
    }

    // Pick random words from unit, preferring words between 4-8 letters
    const eligible = unitWords
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length >= 4 && w.length <= 10 && /^[A-Z]+$/.test(w));

    if (eligible.length === 0) {
      // Fallback: use all words
      const allWords = unitWords
        .map((w) => w.trim().toUpperCase())
        .filter((w) => /^[A-Z]+$/.test(w));
      if (allWords.length === 0) {
        toast({ title: "No valid words for Lingo", variant: "destructive" });
        return;
      }
      const shuffled = [...allWords].sort(() => Math.random() - 0.5);
      setTargetWords(shuffled.slice(0, Math.min(WORDS_PER_ROUND, shuffled.length)));
    } else {
      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      setTargetWords(shuffled.slice(0, Math.min(WORDS_PER_ROUND, shuffled.length)));
    }

    setLoading(false);
  }, [unitWords]);

  // Initialize grid when target word changes
  useEffect(() => {
    if (targetWords.length === 0 || currentWordIndex >= targetWords.length) return;

    const wordLen = targetWords[currentWordIndex].length;
    const emptyGrid: LetterCell[][] = Array.from({ length: MAX_GUESSES }, () =>
      Array.from({ length: wordLen }, () => ({ letter: "", status: "empty" as LetterStatus }))
    );

    // Reveal first letter as a hint
    const firstLetter = targetWords[currentWordIndex][0];
    emptyGrid[0][0] = { letter: firstLetter, status: "correct" };

    setGuesses(emptyGrid);
    setCurrentGuess(firstLetter);
    setCurrentRow(0);
    setWordSolved(false);
    setWordFailed(false);
    setUsedLetters({ [firstLetter]: "correct" });
    setRevealRow(null);
  }, [currentWordIndex, targetWords]);


  const evaluateGuess = useCallback(
    (guess: string): LetterCell[] => {
      const result: LetterCell[] = Array.from({ length: wordLength }, (_, i) => ({
        letter: guess[i],
        status: "absent" as LetterStatus,
      }));

      const targetArr = targetWord.split("");
      const guessArr = guess.split("");
      const used = new Array(wordLength).fill(false);

      // First pass: correct positions
      for (let i = 0; i < wordLength; i++) {
        if (guessArr[i] === targetArr[i]) {
          result[i].status = "correct";
          used[i] = true;
        }
      }

      // Second pass: present but wrong position
      for (let i = 0; i < wordLength; i++) {
        if (result[i].status === "correct") continue;
        for (let j = 0; j < wordLength; j++) {
          if (!used[j] && guessArr[i] === targetArr[j]) {
            result[i].status = "present";
            used[j] = true;
            break;
          }
        }
      }

      return result;
    },
    [targetWord, wordLength]
  );

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== wordLength || wordSolved || wordFailed) return;

    const evaluation = evaluateGuess(currentGuess);
    const newGuesses = [...guesses];
    newGuesses[currentRow] = evaluation;
    setGuesses(newGuesses);
    setRevealRow(currentRow);

    // Update used letters
    const newUsedLetters = { ...usedLetters };
    evaluation.forEach((cell) => {
      const existing = newUsedLetters[cell.letter];
      if (cell.status === "correct") {
        newUsedLetters[cell.letter] = "correct";
      } else if (cell.status === "present" && existing !== "correct") {
        newUsedLetters[cell.letter] = "present";
      } else if (!existing) {
        newUsedLetters[cell.letter] = cell.status;
      }
    });
    setUsedLetters(newUsedLetters);

    const solved = currentGuess === targetWord;
    if (solved) {
      setWordSolved(true);
      setResults((prev) => [...prev, { word: targetWord, solved: true, attempts: currentRow + 1 }]);
    } else if (currentRow >= MAX_GUESSES - 1) {
      setWordFailed(true);
      setResults((prev) => [...prev, { word: targetWord, solved: false, attempts: MAX_GUESSES }]);
    } else {
      setCurrentRow(currentRow + 1);
      setCurrentGuess("");
    }
  }, [currentGuess, wordLength, wordSolved, wordFailed, guesses, currentRow, evaluateGuess, targetWord, usedLetters]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (wordSolved || wordFailed || showCompletion || isExpired) return;

      if (key === "ENTER") {
        if (currentGuess.length === wordLength) {
          submitGuess();
        } else {
          setShakeRow(true);
          setTimeout(() => setShakeRow(false), 500);
        }
      } else if (key === "⌫" || key === "BACKSPACE") {
        // Don't delete the first letter hint on row 0
        const minLen = currentRow === 0 ? 1 : 0;
        if (currentGuess.length > minLen) {
          setCurrentGuess((prev) => prev.slice(0, -1));
        }
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < wordLength) {
        setCurrentGuess((prev) => prev + key);
      }
    },
    [currentGuess, wordLength, wordSolved, wordFailed, showCompletion, submitGuess, currentRow]
  );

  // Physical keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE" || /^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleKeyPress(key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKeyPress]);

  const handleNextWord = () => {
    if (currentWordIndex < targetWords.length - 1) {
      setCurrentWordIndex((prev) => prev + 1);
    } else {
      finishGame();
    }
  };

  const handleSkipWord = () => {
    setResults((prev) => [...prev, { word: targetWord, solved: false, attempts: 0 }]);
    handleNextWord();
  };

  const finishGame = async () => {
    setSaving(true);
    await saveGameAttempt();
    setShowCompletion(true);
    setSaving(false);
  };

  const saveGameAttempt = async () => {
    if (!user || !resolvedGameId) return;

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const solvedCount = results.filter((r) => r.solved).length +
      (wordSolved && !results.find((r) => r.word === targetWord) ? 1 : 0);
    const totalWords = targetWords.length;
    const score = Math.round((solvedCount / totalWords) * 100);
    const isPerfect = solvedCount === totalWords;

    try {
      await supabase.from("game_attempts").insert({
        user_id: user.id,
        unit_id: unitId,
        game_id: resolvedGameId,
        score,
        correct_answers: solvedCount,
        total_questions: totalWords,
        time_spent_seconds: timeSpent,
        completed: true,
      });

      const { data: existingProgress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("unit_id", unitId)
        .eq("game_id", resolvedGameId)
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from("user_progress")
          .update({
            completed: existingProgress.completed || isPerfect,
            attempts: (existingProgress.attempts || 0) + 1,
            total_time_seconds: (existingProgress.total_time_seconds || 0) + timeSpent,
            best_score: Math.max(existingProgress.best_score || 0, score),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProgress.id);
      } else {
        await supabase.from("user_progress").insert({
          user_id: user.id,
          unit_id: unitId,
          game_id: resolvedGameId,
          completed: isPerfect,
          attempts: 1,
          total_time_seconds: timeSpent,
          best_score: score,
        });
      }

      setEarnedXp(score);
    } catch (err) {
      console.error("Error saving game:", err);
    }
  };

  // Celebration
  useEffect(() => {
    if (showCompletion && !hasCelebrated.current) {
      hasCelebrated.current = true;
      const solvedCount = results.filter((r) => r.solved).length;
      celebrate({
        score: solvedCount,
        totalQuestions: targetWords.length,
        gameName: "Lingo",
      });
    }
  }, [showCompletion]);

  const handlePlayAgain = () => {
    hasCelebrated.current = false;
    setResults([]);
    setCurrentWordIndex(0);
    setShowCompletion(false);
    setSaving(false);
    setEarnedXp(0);

    // Re-shuffle words
    const eligible = unitWords
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length >= 4 && w.length <= 10 && /^[A-Z]+$/.test(w));
    const pool = eligible.length > 0 ? eligible : unitWords.map((w) => w.trim().toUpperCase()).filter((w) => /^[A-Z]+$/.test(w));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setTargetWords(shuffled.slice(0, Math.min(WORDS_PER_ROUND, shuffled.length)));
  };

  const getKeyColor = (key: string): string => {
    const status = usedLetters[key];
    switch (status) {
      case "correct":
        return "bg-green-600 text-white border-green-700";
      case "present":
        return "bg-yellow-500 text-white border-yellow-600";
      case "absent":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-card text-foreground border-border hover:bg-accent";
    }
  };

  const getCellColor = (cell: LetterCell, rowIdx: number): string => {
    if (cell.status === "empty" || cell.status === "tbd") {
      return "border-border bg-card";
    }
    if (revealRow !== null && rowIdx > revealRow) {
      return "border-border bg-card";
    }
    switch (cell.status) {
      case "correct":
        return "border-green-600 bg-green-600 text-white";
      case "present":
        return "border-yellow-500 bg-yellow-500 text-white";
      case "absent":
        return "border-muted bg-muted text-muted-foreground";
      default:
        return "border-border bg-card";
    }
  };

  // Render current guess into the grid display
  const getDisplayGrid = (): LetterCell[][] => {
    return guesses.map((row, rowIdx) => {
      if (rowIdx === currentRow && !wordSolved && !wordFailed) {
        return row.map((cell, colIdx) => {
          if (colIdx < currentGuess.length) {
            return { letter: currentGuess[colIdx], status: cell.status === "correct" ? "correct" : "tbd" as LetterStatus };
          }
          return cell;
        });
      }
      return row;
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showCompletion) {
    const solvedCount = results.filter((r) => r.solved).length;
    const score = Math.round((solvedCount / targetWords.length) * 100);

    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <Card className="p-6 space-y-4 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-2xl font-bold">Lingo Complete!</h2>
          <p className="text-muted-foreground">{unitTitle}</p>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{score}%</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {solvedCount}/{targetWords.length}
              </p>
              <p className="text-xs text-muted-foreground">Words Solved</p>
            </div>
          </div>

          <div className="space-y-2 text-left">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-2 rounded-lg border ${
                  r.solved ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <span className="font-medium">{r.word}</span>
                <Badge variant={r.solved ? "default" : "destructive"}>
                  {r.solved ? `${r.attempts} guess${r.attempts > 1 ? "es" : ""}` : "Not solved"}
                </Badge>
              </div>
            ))}
          </div>

          <GameResultActions
            onPlayAgain={handlePlayAgain}
            onBack={onBack}
          />
        </Card>
      </div>
    );
  }

  const displayGrid = getDisplayGrid();

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Lingo
          </h2>
          <p className="text-xs text-muted-foreground">{unitTitle}</p>
        </div>
        <Badge variant="outline">
          {currentWordIndex + 1}/{targetWords.length}
        </Badge>
      </div>

      {/* Timer */}
      <GameTimer
        formattedTime={formattedTime}
        percentage={percentage}
        timerColor={timerColor}
        progressColor={progressColor}
        isExpired={isExpired}
      />

      {/* Word length hint */}
      <div className="text-center">
        <Badge variant="secondary" className="text-xs">
          {wordLength} letters
        </Badge>
      </div>

      {/* Grid */}
      <div className="flex flex-col items-center gap-1.5">
        {displayGrid.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={`flex gap-1.5 ${
              shakeRow && rowIdx === currentRow ? "animate-shake" : ""
            }`}
          >
            {row.map((cell, colIdx) => (
              <div
                key={colIdx}
                className={`w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center border-2 rounded-lg font-bold text-lg sm:text-xl uppercase transition-all duration-300 ${getCellColor(
                  cell,
                  rowIdx
                )} ${
                  cell.letter && cell.status === "tbd"
                    ? "scale-105 border-primary"
                    : ""
                }`}
              >
                {cell.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Word solved / failed feedback */}
      {wordSolved && (
        <div className="text-center space-y-3">
          <p className="text-green-600 font-bold text-lg">🎉 Correct!</p>
          <Button variant="game" onClick={handleNextWord}>
            {currentWordIndex < targetWords.length - 1 ? "Next Word" : "See Results"}
          </Button>
        </div>
      )}

      {wordFailed && (
        <div className="text-center space-y-3">
          <p className="text-destructive font-bold">
            The word was: <span className="text-foreground">{targetWord}</span>
          </p>
          <Button variant="game" onClick={handleNextWord}>
            {currentWordIndex < targetWords.length - 1 ? "Next Word" : "See Results"}
          </Button>
        </div>
      )}

      {/* Keyboard */}
      {!wordSolved && !wordFailed && (
        <div className="space-y-1.5">
          {KEYBOARD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-center gap-1">
              {row.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={`${
                    key === "ENTER" || key === "⌫"
                      ? "px-3 sm:px-4 text-xs"
                      : "w-8 sm:w-10"
                  } h-12 sm:h-14 rounded-lg border font-semibold text-sm transition-colors ${getKeyColor(
                    key
                  )}`}
                >
                  {key === "⌫" ? <Delete className="h-4 w-4 mx-auto" /> : key === "ENTER" ? <CornerDownLeft className="h-4 w-4 mx-auto" /> : key}
                </button>
              ))}
            </div>
          ))}

          {/* Skip button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleSkipWord}
            >
              <SkipForward className="h-3 w-3 mr-1" />
              Skip Word
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
