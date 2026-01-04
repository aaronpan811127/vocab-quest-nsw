import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  RotateCcw, 
  Shuffle,
  Link2,
  Check,
  Loader2,
  Trophy,
  Clock,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Word {
  id: string;
  word: string;
  definition: string;
}

interface MatchingGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

interface MatchItem {
  id: string;
  content: string;
  type: "word" | "definition";
  wordId: string;
  isMatched: boolean;
}

export const MatchingGame = ({ unitId, unitTitle, onComplete, onBack }: MatchingGameProps) => {
  const [words, setWords] = useState<Word[]>([]);
  const [items, setItems] = useState<MatchItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MatchItem | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [incorrectPair, setIncorrectPair] = useState<[string, string] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [moves, setMoves] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchVocabulary();
  }, [unitId]);

  const generateVocabulary = async (unitWords: string[]) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-vocabulary', {
        body: { unit_id: unitId, words: unitWords }
      });

      if (error) throw error;

      if (data.success && data.vocabulary) {
        setWords(data.vocabulary);
        shuffleItems(data.vocabulary);
        toast({
          title: "Vocabulary Generated",
          description: `Created matching game for ${data.vocabulary.length} words.`,
        });
      } else {
        throw new Error(data.error || "Failed to generate vocabulary");
      }
    } catch (err: any) {
      console.error('Error generating vocabulary:', err);
      toast({
        title: "Generation failed",
        description: "Could not generate vocabulary.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const fetchVocabulary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('unit_id', unitId);

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('words')
          .eq('id', unitId)
          .single();

        if (unitError) throw unitError;

        const unitWords = unitData.words as string[];
        
        const basicWords: Word[] = unitWords.slice(0, 8).map((word, index) => ({
          id: `temp-${index}`,
          word,
          definition: "Loading definition..."
        }));
        setWords(basicWords);
        shuffleItems(basicWords);
        setLoading(false);
        
        await generateVocabulary(unitWords);
      } else {
        // Limit to 8 words for the matching game
        const limitedWords = data.slice(0, 8) as Word[];
        setWords(limitedWords);
        shuffleItems(limitedWords);
      }
    } catch (err) {
      console.error('Error fetching vocabulary:', err);
      setError("Failed to load vocabulary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const shuffleItems = (wordList: Word[]) => {
    const wordItems: MatchItem[] = wordList.map(w => ({
      id: `word-${w.id}`,
      content: w.word,
      type: "word",
      wordId: w.id,
      isMatched: false
    }));

    const defItems: MatchItem[] = wordList.map(w => ({
      id: `def-${w.id}`,
      content: w.definition,
      type: "definition",
      wordId: w.id,
      isMatched: false
    }));

    // Shuffle both arrays separately
    const shuffledWords = [...wordItems].sort(() => Math.random() - 0.5);
    const shuffledDefs = [...defItems].sort(() => Math.random() - 0.5);

    setItems([...shuffledWords, ...shuffledDefs]);
    setMatchedPairs(new Set());
    setSelectedItem(null);
    setMoves(0);
  };

  const handleItemClick = (item: MatchItem) => {
    if (item.isMatched || matchedPairs.has(item.wordId)) return;

    if (!selectedItem) {
      setSelectedItem(item);
      return;
    }

    // Can't select same type
    if (selectedItem.type === item.type) {
      setSelectedItem(item);
      return;
    }

    setMoves(m => m + 1);

    // Check if it's a match
    if (selectedItem.wordId === item.wordId) {
      // Correct match!
      const newMatched = new Set(matchedPairs);
      newMatched.add(item.wordId);
      setMatchedPairs(newMatched);
      setSelectedItem(null);

      // Update items to mark as matched
      setItems(prev => prev.map(i => 
        i.wordId === item.wordId ? { ...i, isMatched: true } : i
      ));
    } else {
      // Wrong match - show error briefly
      setIncorrectPair([selectedItem.id, item.id]);
      setTimeout(() => {
        setIncorrectPair(null);
        setSelectedItem(null);
      }, 600);
    }
  };

  const handleShuffle = () => {
    shuffleItems(words);
  };

  const handleReset = () => {
    shuffleItems(words);
  };

  const saveGameAttempt = async () => {
    if (!user) return;

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const score = Math.round((words.length / Math.max(moves, words.length)) * 100);

    try {
      // Save game attempt
      await supabase.from('game_attempts').insert({
        user_id: user.id,
        unit_id: unitId,
        game_type: 'matching',
        score: Math.min(score, 100),
        correct_answers: words.length,
        total_questions: words.length,
        time_spent_seconds: timeSpent,
        completed: true
      });

      // Save/update user_progress for completion tracking
      const { data: existingProgress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('unit_id', unitId)
        .eq('game_type', 'matching')
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from('user_progress')
          .update({
            completed: true,
            attempts: (existingProgress.attempts || 0) + 1,
            total_time_seconds: (existingProgress.total_time_seconds || 0) + timeSpent,
            best_score: Math.max(existingProgress.best_score || 0, Math.min(score, 100)),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id);
      } else {
        await supabase
          .from('user_progress')
          .insert({
            user_id: user.id,
            unit_id: unitId,
            game_type: 'matching',
            completed: true,
            attempts: 1,
            total_time_seconds: timeSpent,
            best_score: Math.min(score, 100)
          });
      }
    } catch (err) {
      console.error('Error saving game attempt:', err);
    }
  };

  const progress = words.length > 0 ? ((matchedPairs.size / words.length) * 100) : 0;
  const isComplete = matchedPairs.size === words.length && words.length > 0;
  const timeSpent = Math.round((Date.now() - startTime) / 1000);

  // Save when complete
  useEffect(() => {
    if (isComplete) {
      saveGameAttempt();
    }
  }, [isComplete]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Loading matching game...</p>
          </div>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">Generating vocabulary...</p>
            <p className="text-muted-foreground">Creating definitions for matching</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || words.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="text-6xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold">{error || "No vocabulary available"}</h2>
            <p className="text-muted-foreground">
              Please check back later or try a different unit.
            </p>
            <Button variant="outline" onClick={onBack} size="lg">
              Back to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    const score = Math.round((words.length / Math.max(moves, words.length)) * 100);
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-primary">All Matched!</h2>
            <p className="text-lg text-muted-foreground">
              You matched all {words.length} word pairs in {unitTitle}!
            </p>
            
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="text-center">
                <Trophy className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                <p className="text-2xl font-bold">{Math.min(score, 100)}%</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div className="text-center">
                <Zap className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{moves}</p>
                <p className="text-sm text-muted-foreground">Moves</p>
              </div>
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{timeSpent}s</p>
                <p className="text-sm text-muted-foreground">Time</p>
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={handleReset} size="lg">
                <RotateCcw className="h-5 w-5 mr-2" />
                Play Again
              </Button>
              <Button variant="hero" onClick={onComplete} size="lg">
                <Check className="h-5 w-5 mr-2" />
                Complete
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const wordItems = items.filter(i => i.type === "word");
  const defItems = items.filter(i => i.type === "definition");

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="truncate">{unitTitle}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Match words with their definitions • {moves} moves
            </p>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span>Matched: {matchedPairs.size} / {words.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Matching Grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {/* Words Column */}
          <div className="space-y-3">
            <Badge variant="secondary" className="mb-2">Words</Badge>
            {wordItems.map(item => (
              <Card
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`
                  p-3 sm:p-4 cursor-pointer transition-all duration-200 text-center
                  ${item.isMatched 
                    ? 'bg-green-500/20 border-green-500/50 opacity-60' 
                    : selectedItem?.id === item.id
                      ? 'bg-primary/20 border-primary ring-2 ring-primary/50'
                      : incorrectPair?.includes(item.id)
                        ? 'bg-red-500/20 border-red-500 animate-shake'
                        : 'hover:bg-primary/10 hover:border-primary/50'
                  }
                `}
              >
                <p className="font-semibold text-sm sm:text-base">{item.content}</p>
                {item.isMatched && (
                  <Check className="h-4 w-4 text-green-500 mx-auto mt-1" />
                )}
              </Card>
            ))}
          </div>

          {/* Definitions Column */}
          <div className="space-y-3">
            <Badge variant="secondary" className="mb-2">Definitions</Badge>
            {defItems.map(item => (
              <Card
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`
                  p-3 sm:p-4 cursor-pointer transition-all duration-200
                  ${item.isMatched 
                    ? 'bg-green-500/20 border-green-500/50 opacity-60' 
                    : selectedItem?.id === item.id
                      ? 'bg-primary/20 border-primary ring-2 ring-primary/50'
                      : incorrectPair?.includes(item.id)
                        ? 'bg-red-500/20 border-red-500 animate-shake'
                        : 'hover:bg-primary/10 hover:border-primary/50'
                  }
                `}
              >
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">{item.content}</p>
                {item.isMatched && (
                  <Check className="h-4 w-4 text-green-500 mx-auto mt-1" />
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <Shuffle className="h-4 w-4 mr-2" />
            Shuffle
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
};
