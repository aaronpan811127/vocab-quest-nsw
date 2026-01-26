import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, TrendingDown, BookOpen, Volume2, Mic, Target, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTestType } from "@/contexts/TestTypeContext";

interface WordStruggleData {
  word: string;
  incorrectCount: number;
  totalAttempts: number;
  successRate: number;
  lastIncorrectDate: string;
  gameTypes: string[];
}

interface GameTypeStats {
  gameType: string;
  totalIncorrect: number;
  uniqueWords: number;
}

export const WordStruggleAnalytics = () => {
  const { user } = useAuth();
  const { selectedTestType } = useTestType();
  const [loading, setLoading] = useState(true);
  const [wordData, setWordData] = useState<WordStruggleData[]>([]);
  const [dictationData, setDictationData] = useState<WordStruggleData[]>([]);
  const [gameStats, setGameStats] = useState<GameTypeStats[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user && selectedTestType) {
      fetchAnalytics();
    }
  }, [user, selectedTestType]);

  const fetchAnalytics = async () => {
    if (!user || !selectedTestType) return;
    setLoading(true);

    try {
      const { data: units } = await supabase
        .from("units")
        .select("id")
        .eq("test_type_id", selectedTestType.id);

      if (!units || units.length === 0) {
        setLoading(false);
        return;
      }

      const unitIds = units.map((u) => u.id);

      const { data: attempts } = await supabase
        .from("game_attempts")
        .select("id, game_id, unit_id, created_at")
        .eq("user_id", user.id)
        .in("unit_id", unitIds);

      if (!attempts || attempts.length === 0) {
        setLoading(false);
        return;
      }

      const attemptIds = attempts.map((a) => a.id);

      const { data: incorrectAnswers } = await supabase
        .from("attempt_incorrect_answers")
        .select(`id, attempt_id, question_id, user_answer, created_at`)
        .in("attempt_id", attemptIds);

      const questionIds = [...new Set(incorrectAnswers?.map((a) => a.question_id) || [])];
      let questionWordMap: Record<string, string> = {};
      
      if (questionIds.length > 0) {
        const { data: questions } = await supabase
          .from("question_bank")
          .select("id, word, game_id")
          .in("id", questionIds);

        if (questions) {
          questions.forEach((q) => {
            if (q.word) {
              questionWordMap[q.id] = q.word;
            }
          });
        }
      }

      const { data: dictationIncorrect } = await supabase
        .from("attempt_incorrect_answers_dictation")
        .select("id, attempt_id, incorrect_word, user_answer, created_at")
        .in("attempt_id", attemptIds);

      const gameIds = [...new Set(attempts.map((a) => a.game_id))];
      const { data: games } = await supabase
        .from("games")
        .select("id, game_type, name")
        .in("id", gameIds);

      const gameMap: Record<string, { type: string; name: string }> = {};
      games?.forEach((g) => {
        gameMap[g.id] = { type: g.game_type, name: g.name };
      });

      const attemptGameMap: Record<string, string> = {};
      attempts.forEach((a) => {
        attemptGameMap[a.id] = a.game_id;
      });

      const wordIncorrectMap: Record<string, { 
        count: number; 
        dates: string[];
        gameTypes: Set<string>;
      }> = {};

      incorrectAnswers?.forEach((ia) => {
        const word = questionWordMap[ia.question_id];
        if (word) {
          const normalizedWord = word.toLowerCase();
          if (!wordIncorrectMap[normalizedWord]) {
            wordIncorrectMap[normalizedWord] = { count: 0, dates: [], gameTypes: new Set() };
          }
          wordIncorrectMap[normalizedWord].count++;
          wordIncorrectMap[normalizedWord].dates.push(ia.created_at);
          const gameId = attemptGameMap[ia.attempt_id];
          if (gameId && gameMap[gameId]) {
            wordIncorrectMap[normalizedWord].gameTypes.add(gameMap[gameId].type);
          }
        }
      });

      const dictationIncorrectMap: Record<string, {
        count: number;
        dates: string[];
        gameTypes: Set<string>;
      }> = {};

      dictationIncorrect?.forEach((ia) => {
        const normalizedWord = ia.incorrect_word.toLowerCase();
        if (!dictationIncorrectMap[normalizedWord]) {
          dictationIncorrectMap[normalizedWord] = { count: 0, dates: [], gameTypes: new Set() };
        }
        dictationIncorrectMap[normalizedWord].count++;
        dictationIncorrectMap[normalizedWord].dates.push(ia.created_at);
        const gameId = attemptGameMap[ia.attempt_id];
        if (gameId && gameMap[gameId]) {
          dictationIncorrectMap[normalizedWord].gameTypes.add(gameMap[gameId].type);
        }
      });

      const wordDataArray: WordStruggleData[] = Object.entries(wordIncorrectMap)
        .map(([word, data]) => ({
          word,
          incorrectCount: data.count,
          totalAttempts: data.count,
          successRate: 0,
          lastIncorrectDate: data.dates.sort().reverse()[0] || "",
          gameTypes: Array.from(data.gameTypes),
        }))
        .sort((a, b) => b.incorrectCount - a.incorrectCount);

      const dictationDataArray: WordStruggleData[] = Object.entries(dictationIncorrectMap)
        .map(([word, data]) => ({
          word,
          incorrectCount: data.count,
          totalAttempts: data.count,
          successRate: 0,
          lastIncorrectDate: data.dates.sort().reverse()[0] || "",
          gameTypes: Array.from(data.gameTypes),
        }))
        .sort((a, b) => b.incorrectCount - a.incorrectCount);

      const gameTypeStatsMap: Record<string, { incorrect: number; words: Set<string> }> = {};
      
      incorrectAnswers?.forEach((ia) => {
        const gameId = attemptGameMap[ia.attempt_id];
        const gameType = gameId && gameMap[gameId] ? gameMap[gameId].type : "unknown";
        if (!gameTypeStatsMap[gameType]) {
          gameTypeStatsMap[gameType] = { incorrect: 0, words: new Set() };
        }
        gameTypeStatsMap[gameType].incorrect++;
        const word = questionWordMap[ia.question_id];
        if (word) gameTypeStatsMap[gameType].words.add(word.toLowerCase());
      });

      dictationIncorrect?.forEach((ia) => {
        const gameId = attemptGameMap[ia.attempt_id];
        const gameType = gameId && gameMap[gameId] ? gameMap[gameId].type : "dictation";
        if (!gameTypeStatsMap[gameType]) {
          gameTypeStatsMap[gameType] = { incorrect: 0, words: new Set() };
        }
        gameTypeStatsMap[gameType].incorrect++;
        gameTypeStatsMap[gameType].words.add(ia.incorrect_word.toLowerCase());
      });

      const gameStatsArray: GameTypeStats[] = Object.entries(gameTypeStatsMap)
        .map(([gameType, data]) => ({
          gameType,
          totalIncorrect: data.incorrect,
          uniqueWords: data.words.size,
        }))
        .sort((a, b) => b.totalIncorrect - a.totalIncorrect);

      setWordData(wordDataArray);
      setDictationData(dictationDataArray);
      setGameStats(gameStatsArray);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const allWords = [...wordData, ...dictationData].sort((a, b) => b.incorrectCount - a.incorrectCount);
  const totalIncorrect = allWords.reduce((sum, w) => sum + w.incorrectCount, 0);
  const uniqueStruggleWords = new Set([...wordData.map(w => w.word), ...dictationData.map(w => w.word)]).size;
  const topWords = allWords.slice(0, 3);

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Compact Summary Card */}
      <Card 
        className="border-border/50 bg-card/80 backdrop-blur-sm cursor-pointer hover:bg-card/90 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <TrendingDown className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Words to Practice</h3>
                {allWords.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No mistakes yet - keep it up!</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="text-destructive font-semibold">{uniqueStruggleWords}</span> words need review
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {topWords.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {topWords.map((w, i) => (
                    <Badge key={i} variant="outline" className="text-xs capitalize">
                      {w.word}
                    </Badge>
                  ))}
                </div>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Dashboard Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Words to Practice
            </DialogTitle>
            <DialogDescription>
              Focus on these words to improve your score
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4">
            {allWords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-success/10 p-4 mb-4">
                  <Target className="h-8 w-8 text-success" />
                </div>
                <p className="text-muted-foreground">
                  Great job! No mistakes recorded yet. Keep practicing!
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-destructive/10 p-3 text-center">
                    <div className="text-2xl font-bold text-destructive">{totalIncorrect}</div>
                    <div className="text-xs text-muted-foreground">Total Mistakes</div>
                  </div>
                  <div className="rounded-lg bg-warning/10 p-3 text-center">
                    <div className="text-2xl font-bold text-warning">{uniqueStruggleWords}</div>
                    <div className="text-xs text-muted-foreground">Words to Review</div>
                  </div>
                </div>

                {/* Game Type Breakdown */}
                {gameStats.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">By Game Type</h4>
                    <div className="flex flex-wrap gap-2">
                      {gameStats.slice(0, 4).map((stat) => (
                        <Badge
                          key={stat.gameType}
                          variant="outline"
                          className="flex items-center gap-1.5 py-1"
                        >
                          <GameTypeIcon gameType={stat.gameType} />
                          <span>{formatGameType(stat.gameType)}</span>
                          <span className="ml-1 rounded-full bg-destructive/20 px-1.5 text-xs text-destructive">
                            {stat.totalIncorrect}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Word Lists */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all" className="text-xs">All ({allWords.length})</TabsTrigger>
                    <TabsTrigger value="quiz" className="text-xs">Quiz ({wordData.length})</TabsTrigger>
                    <TabsTrigger value="dictation" className="text-xs">Audio ({dictationData.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="mt-3">
                    <WordList words={allWords.slice(0, 10)} maxCount={allWords[0]?.incorrectCount || 1} />
                  </TabsContent>

                  <TabsContent value="quiz" className="mt-3">
                    <WordList words={wordData.slice(0, 10)} maxCount={wordData[0]?.incorrectCount || 1} />
                  </TabsContent>

                  <TabsContent value="dictation" className="mt-3">
                    <WordList words={dictationData.slice(0, 10)} maxCount={dictationData[0]?.incorrectCount || 1} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const GameTypeIcon = ({ gameType }: { gameType: string }) => {
  switch (gameType) {
    case "listening":
    case "audio_challenge":
      return <Volume2 className="h-4 w-4" />;
    case "voice_master":
      return <Mic className="h-4 w-4" />;
    case "reading":
      return <BookOpen className="h-4 w-4" />;
    default:
      return <Target className="h-4 w-4" />;
  }
};

const formatGameType = (type: string) => {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

interface WordListProps {
  words: WordStruggleData[];
  maxCount: number;
}

const WordList = ({ words, maxCount }: WordListProps) => {
  if (words.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No mistakes in this category yet!
      </div>
    );
  }

  return (
    <ScrollArea className="h-[280px] pr-4">
      <div className="space-y-2">
        {words.map((word, index) => (
          <div
            key={`${word.word}-${index}`}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-xs font-bold text-destructive">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium capitalize truncate">{word.word}</span>
                {word.incorrectCount >= 3 && (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                )}
              </div>
              <div className="mt-1">
                <Progress
                  value={(word.incorrectCount / maxCount) * 100}
                  className="h-1.5 bg-muted"
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-semibold text-destructive">
                {word.incorrectCount}x
              </div>
              <div className="text-xs text-muted-foreground">wrong</div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
