import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, BookOpen, FileQuestion, Sparkles, Wand2, ChevronDown, ChevronRight } from "lucide-react";

interface TestType {
  id: string;
  name: string;
  code: string;
}

interface Unit {
  id: string;
  title: string;
  unit_number: number;
  test_type_id: string | null;
  words: string[];
}

interface GameRules {
  questions_per_word?: number;
  questions_per_game?: number;
  questions_per_passage?: number;
  passages_per_game?: number;
  words_per_game?: number;
}

interface Game {
  id: string;
  name: string;
  game_type: string;
  rules: GameRules | null;
}

interface WordQuestionCount {
  word: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  required: number;
}

interface ContentStat {
  game_id: string;
  game_name: string;
  game_type: string;
  unit_id: string;
  unit_title: string;
  unit_number: number;
  total_words: number;
  // For question-based games
  question_count: number;
  approved_questions: number;
  pending_questions: number;
  rejected_questions: number;
  // For passage-based games
  passage_count: number;
  approved_passages: number;
  pending_passages: number;
  rejected_passages: number;
  // For vocabulary/flashcards
  vocab_count: number;
  approved_vocab: number;
  pending_vocab: number;
  rejected_vocab: number;
  // Rules
  required_questions: number;
  required_passages: number;
  required_vocab: number;
  // Status
  meets_requirement: boolean;
  // Word-level breakdown for word-based games
  questionsByWord?: WordQuestionCount[];
}

// Game types that use passages
const PASSAGE_GAME_TYPES = ['reading', 'cloze_passage'];

// Game types that use vocabulary
const VOCAB_GAME_TYPES = ['flashcards'];

// Game types excluded from stats (no reviewable content)
const EXCLUDED_GAME_TYPES = ['listening', 'matching', 'speaking', 'writing', 'oddoneout'];

// Word-based game types that should show per-word breakdown
const WORD_BASED_GAME_TYPES = ['intuition', 'context_master', 'cloze_challenge'];

export const AdminContentStats = () => {
  const [loading, setLoading] = useState(true);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [testTypeFilter, setTestTypeFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [units, setUnits] = useState<Unit[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<ContentStat[]>([]);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatingUnit, setGeneratingUnit] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleExpanded = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getTestTypeCode = () => {
    const testType = testTypes.find(t => t.id === testTypeFilter);
    return testType?.code || 'SELECTIVE';
  };

  const handleGenerate = async (stat: ContentStat) => {
    const unit = units.find(u => u.id === stat.unit_id);
    if (!unit) return;

    const generatingKey = `${stat.unit_id}-${stat.game_id}`;
    setGeneratingFor(generatingKey);

    try {
      const testTypeCode = getTestTypeCode();
      const isPassageGame = PASSAGE_GAME_TYPES.includes(stat.game_type);
      const isVocabGame = VOCAB_GAME_TYPES.includes(stat.game_type);

      let functionName: string;
      let payload: Record<string, unknown>;

      // Supported question-based game types for generate-test-questions
      const QUESTION_GAME_TYPES = ['context_master', 'cloze_challenge'];

      if (isVocabGame) {
        functionName = 'generate-vocabulary';
        payload = { unit_id: stat.unit_id, words: unit.words };
      } else if (stat.game_type === 'cloze_passage') {
        functionName = 'generate-cloze-passage';
        payload = { unit_id: stat.unit_id, words: unit.words, test_type_code: testTypeCode, unit_title: unit.title };
      } else if (stat.game_type === 'reading') {
        functionName = 'generate-passage';
        payload = { unit_id: stat.unit_id, words: unit.words, test_type_code: testTypeCode, unit_title: unit.title };
      } else if (stat.game_type === 'intuition') {
        functionName = 'generate-intuition-questions';
        payload = { unit_id: stat.unit_id, words: unit.words };
      } else if (QUESTION_GAME_TYPES.includes(stat.game_type)) {
        functionName = 'generate-test-questions';
        payload = { 
          unit_id: stat.unit_id, 
          words: unit.words, 
          game_type: stat.game_type,
          game_id: stat.game_id,
          test_type_code: testTypeCode 
        };
      } else {
        toast({
          title: "Generation Not Supported",
          description: `AI generation is not available for ${stat.game_name}`,
          variant: "destructive",
        });
        setGeneratingFor(null);
        return;
      }

      // For passage-based games, loop until we have enough passages
      const isPassageBasedGame = ['cloze_passage', 'reading'].includes(stat.game_type);
      let totalGenerated = 0;
      const maxIterations = 5; // Safety limit
      
      if (isPassageBasedGame) {
        for (let i = 0; i < maxIterations; i++) {
          const { data, error } = await supabase.functions.invoke(functionName, {
            body: payload
          });

          if (error) throw error;
          
          // If skipped, we have enough passages
          if (data?.skipped) {
            console.log('Generation skipped - sufficient passages exist');
            break;
          }
          
          totalGenerated++;
          console.log(`Generated passage ${totalGenerated}`);
        }
        
        toast({
          title: "Generation Complete",
          description: totalGenerated > 0 
            ? `Successfully generated ${totalGenerated} passage(s) for ${stat.game_name}` 
            : `${stat.game_name} already has enough passages`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: payload
        });

        if (error) throw error;

        toast({
          title: "Generation Complete",
          description: `Successfully generated content for ${stat.game_name}`,
        });
      }

      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  // Generate all content for a specific unit
  const handleGenerateUnit = async (unitId: string) => {
    const unitStats = stats.filter(s => s.unit_id === unitId && !s.meets_requirement);
    if (unitStats.length === 0) {
      toast({
        title: "Already Complete",
        description: "All games in this unit meet their requirements.",
      });
      return;
    }

    setGeneratingUnit(unitId);
    let successCount = 0;
    let errorCount = 0;

    for (const stat of unitStats) {
      try {
        await handleGenerateSingle(stat);
        successCount++;
      } catch (error) {
        console.error('Generation error for', stat.game_name, error);
        errorCount++;
      }
    }

    setGeneratingUnit(null);
    await fetchStats();

    toast({
      title: "Unit Generation Complete",
      description: `Generated content for ${successCount} game(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
    });
  };

  // Generate all content globally (all units)
  const handleGenerateAll = async () => {
    const incompleteStats = stats.filter(s => !s.meets_requirement);
    if (incompleteStats.length === 0) {
      toast({
        title: "Already Complete",
        description: "All games meet their requirements.",
      });
      return;
    }

    setGeneratingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const stat of incompleteStats) {
      try {
        await handleGenerateSingle(stat);
        successCount++;
      } catch (error) {
        console.error('Generation error for', stat.game_name, error);
        errorCount++;
      }
    }

    setGeneratingAll(false);
    await fetchStats();

    toast({
      title: "Global Generation Complete",
      description: `Generated content for ${successCount} game(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
    });
  };

  // Single generation helper (extracted from handleGenerate)
  const handleGenerateSingle = async (stat: ContentStat) => {
    const unit = units.find(u => u.id === stat.unit_id);
    if (!unit) throw new Error('Unit not found');

    const testTypeCode = getTestTypeCode();
    const isPassageGame = PASSAGE_GAME_TYPES.includes(stat.game_type);
    const isVocabGame = VOCAB_GAME_TYPES.includes(stat.game_type);

    let functionName: string;
    let payload: Record<string, unknown>;

    const QUESTION_GAME_TYPES = ['context_master', 'cloze_challenge'];

    if (isVocabGame) {
      functionName = 'generate-vocabulary';
      payload = { unit_id: stat.unit_id, words: unit.words };
    } else if (stat.game_type === 'cloze_passage') {
      functionName = 'generate-cloze-passage';
      payload = { unit_id: stat.unit_id, words: unit.words, test_type_code: testTypeCode, unit_title: unit.title };
    } else if (stat.game_type === 'reading') {
      functionName = 'generate-passage';
      payload = { unit_id: stat.unit_id, words: unit.words, test_type_code: testTypeCode, unit_title: unit.title };
    } else if (stat.game_type === 'intuition') {
      functionName = 'generate-intuition-questions';
      payload = { unit_id: stat.unit_id, words: unit.words };
    } else if (QUESTION_GAME_TYPES.includes(stat.game_type)) {
      functionName = 'generate-test-questions';
      payload = { 
        unit_id: stat.unit_id, 
        words: unit.words, 
        game_type: stat.game_type,
        game_id: stat.game_id,
        test_type_code: testTypeCode 
      };
    } else {
      throw new Error(`Generation not supported for ${stat.game_name}`);
    }

    // For passage-based games, loop until we have enough passages
    const isPassageBasedGame = ['cloze_passage', 'reading'].includes(stat.game_type);
    const maxIterations = 5;
    
    if (isPassageBasedGame) {
      for (let i = 0; i < maxIterations; i++) {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: payload
        });

        if (error) throw error;
        if (data?.skipped) break;
      }
    } else {
      const { error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) throw error;
    }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [testTypesRes, gamesRes] = await Promise.all([
          supabase.from('test_types').select('id, name, code').order('name'),
          supabase.from('games').select('id, name, game_type, rules')
        ]);

        if (testTypesRes.data) {
          setTestTypes(testTypesRes.data);
          const selective = testTypesRes.data.find(t => t.code === 'SELECTIVE');
          setTestTypeFilter(selective?.id || testTypesRes.data[0]?.id || '');
        }
        if (gamesRes.data) {
          setGames(gamesRes.data as Game[]);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch units when test type changes
  useEffect(() => {
    if (!testTypeFilter) return;
    
    const fetchUnits = async () => {
      const { data } = await supabase
        .from('units')
        .select('id, title, unit_number, test_type_id, words')
        .eq('test_type_id', testTypeFilter)
        .order('unit_number');
      
      if (data) {
        setUnits(data as Unit[]);
      }
    };
    fetchUnits();
  }, [testTypeFilter]);

  // Fetch stats when filters change
  useEffect(() => {
    if (!testTypeFilter || games.length === 0 || units.length === 0) return;
    fetchStats();
  }, [testTypeFilter, unitFilter, games, units]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const filteredUnits = unitFilter === 'all' 
        ? units 
        : units.filter(u => u.id === unitFilter);

      const reviewableGames = games.filter(g => !EXCLUDED_GAME_TYPES.includes(g.game_type));
      
      const statsPromises = filteredUnits.flatMap(unit => 
        reviewableGames.map(async (game) => {
          const rules = game.rules || {};
          const isPassageGame = PASSAGE_GAME_TYPES.includes(game.game_type);
          const isVocabGame = VOCAB_GAME_TYPES.includes(game.game_type);
          const totalWords = Array.isArray(unit.words) ? unit.words.length : 0;

          let stat: ContentStat = {
            game_id: game.id,
            game_name: game.name,
            game_type: game.game_type,
            unit_id: unit.id,
            unit_title: unit.title,
            unit_number: unit.unit_number,
            total_words: totalWords,
            question_count: 0,
            approved_questions: 0,
            pending_questions: 0,
            rejected_questions: 0,
            passage_count: 0,
            approved_passages: 0,
            pending_passages: 0,
            rejected_passages: 0,
            vocab_count: 0,
            approved_vocab: 0,
            pending_vocab: 0,
            rejected_vocab: 0,
            required_questions: 0,
            required_passages: 0,
            required_vocab: 0,
            meets_requirement: false,
          };

          if (isVocabGame) {
            // Fetch vocabulary stats
            const { data: vocabData } = await supabase
              .from('vocabulary')
              .select('id, review_status')
              .eq('unit_id', unit.id);

            const vocab = vocabData || [];
            stat.vocab_count = vocab.length;
            stat.approved_vocab = vocab.filter(v => v.review_status === 'approved').length;
            stat.pending_vocab = vocab.filter(v => v.review_status === 'pending').length;
            stat.rejected_vocab = vocab.filter(v => v.review_status === 'rejected').length;
            stat.required_vocab = totalWords; // One vocab entry per word
            stat.meets_requirement = (stat.vocab_count - stat.rejected_vocab) >= stat.required_vocab;
          } else if (isPassageGame) {
            // Fetch passage stats
            const passagesPerGame = rules.passages_per_game || 3;
            const questionsPerPassage = rules.questions_per_passage || 10;
            
            const passageFilter = game.game_type === 'cloze_passage' 
              ? { ilike: 'Cloze Passage:%' }
              : { notIlike: 'Cloze Passage:%' };

            let passageQuery = supabase
              .from('reading_passages')
              .select('id, review_status')
              .eq('unit_id', unit.id);
            
            if (game.game_type === 'cloze_passage') {
              passageQuery = passageQuery.ilike('title', 'Cloze Passage:%');
            } else {
              passageQuery = passageQuery.not('title', 'ilike', 'Cloze Passage:%');
            }

            const { data: passageData } = await passageQuery;
            const passages = passageData || [];
            
            stat.passage_count = passages.length;
            stat.approved_passages = passages.filter(p => p.review_status === 'approved').length;
            stat.pending_passages = passages.filter(p => p.review_status === 'pending').length;
            stat.rejected_passages = passages.filter(p => p.review_status === 'rejected').length;
            stat.required_passages = passagesPerGame;

            // Fetch question stats for non-rejected passages
            const nonRejectedPassageIds = passages
              .filter(p => p.review_status !== 'rejected')
              .map(p => p.id);

            if (nonRejectedPassageIds.length > 0) {
              const { data: questionData } = await supabase
                .from('question_bank')
                .select('id, review_status')
                .eq('game_id', game.id)
                .eq('unit_id', unit.id)
                .in('passage_id', nonRejectedPassageIds);

              const questions = questionData || [];
              stat.question_count = questions.length;
              stat.approved_questions = questions.filter(q => q.review_status === 'approved').length;
              stat.pending_questions = questions.filter(q => q.review_status === 'pending').length;
              stat.rejected_questions = questions.filter(q => q.review_status === 'rejected').length;
              stat.required_questions = passagesPerGame * questionsPerPassage;
            }

            // Meets requirement if we have enough non-rejected passages
            stat.meets_requirement = (stat.passage_count - stat.rejected_passages) >= stat.required_passages;
          } else {
            // Regular question-based games
            const questionsPerWord = rules.questions_per_word || 3;
            const questionsPerGame = rules.questions_per_game || 10;
            const isWordBasedGame = WORD_BASED_GAME_TYPES.includes(game.game_type);

            const { data: questionData } = await supabase
              .from('question_bank')
              .select('id, review_status, word')
              .eq('game_id', game.id)
              .eq('unit_id', unit.id);

            const questions = questionData || [];
            stat.question_count = questions.length;
            stat.approved_questions = questions.filter(q => q.review_status === 'approved').length;
            stat.pending_questions = questions.filter(q => q.review_status === 'pending').length;
            stat.rejected_questions = questions.filter(q => q.review_status === 'rejected').length;
            stat.required_questions = totalWords * questionsPerWord;

            // For word-based games, build per-word breakdown
            if (isWordBasedGame && Array.isArray(unit.words)) {
              const wordCounts: Record<string, WordQuestionCount> = {};
              
              // Initialize all unit words
              unit.words.forEach(word => {
                const lowerWord = word.toLowerCase();
                wordCounts[lowerWord] = {
                  word: word,
                  total: 0,
                  approved: 0,
                  pending: 0,
                  rejected: 0,
                  required: questionsPerWord
                };
              });

              // Count questions per word
              questions.forEach(q => {
                const qWord = q.word?.toLowerCase();
                if (qWord && wordCounts[qWord]) {
                  wordCounts[qWord].total++;
                  if (q.review_status === 'approved') {
                    wordCounts[qWord].approved++;
                  } else if (q.review_status === 'pending') {
                    wordCounts[qWord].pending++;
                  } else if (q.review_status === 'rejected') {
                    wordCounts[qWord].rejected++;
                  }
                }
              });

              stat.questionsByWord = Object.values(wordCounts).sort((a, b) => 
                a.word.localeCompare(b.word)
              );
            }

            // Meets requirement if non-rejected questions >= required
            stat.meets_requirement = (stat.question_count - stat.rejected_questions) >= stat.required_questions;
          }

          return stat;
        })
      );

      const allStats = await Promise.all(statsPromises);
      setStats(allStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch content statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group stats by unit
  const statsByUnit = stats.reduce((acc, stat) => {
    if (!acc[stat.unit_id]) {
      acc[stat.unit_id] = {
        unit_title: stat.unit_title,
        unit_number: stat.unit_number,
        total_words: stat.total_words,
        games: []
      };
    }
    acc[stat.unit_id].games.push(stat);
    return acc;
  }, {} as Record<string, { unit_title: string; unit_number: number; total_words: number; games: ContentStat[] }>);

  const sortedUnits = Object.entries(statsByUnit).sort((a, b) => a[1].unit_number - b[1].unit_number);

  const getProgressColor = (current: number, required: number) => {
    const percentage = required > 0 ? (current / required) * 100 : 100;
    if (percentage >= 100) return 'bg-success';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  const formatGameType = (gameType: string) => {
    return gameType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const incompleteCount = stats.filter(s => !s.meets_requirement).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Content Statistics</h2>
          {/* Global Generate All Button */}
          {incompleteCount > 0 && (
            <Button
              onClick={handleGenerateAll}
              disabled={generatingAll || generatingUnit !== null}
              className="gap-2"
            >
              {generatingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate All ({incompleteCount})
            </Button>
          )}
        </div>

        {/* Test Type Radio Buttons */}
        <RadioGroup 
          value={testTypeFilter} 
          onValueChange={(value) => { setTestTypeFilter(value); setUnitFilter("all"); }}
          className="flex flex-wrap gap-4"
        >
          {testTypes.map((tt) => (
            <div key={tt.id} className="flex items-center space-x-2">
              <RadioGroupItem value={tt.id} id={`stats-tt-${tt.id}`} />
              <Label htmlFor={`stats-tt-${tt.id}`} className="cursor-pointer">{tt.name}</Label>
            </div>
          ))}
        </RadioGroup>

        {/* Unit Filter */}
        <div className="flex gap-4">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  Unit {unit.unit_number}: {unit.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sortedUnits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No data available for the selected filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedUnits.map(([unitId, unitData]) => (
            <Card key={unitId}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Unit {unitData.unit_number}: {unitData.unit_title}
                    </CardTitle>
                    <CardDescription>
                      {unitData.total_words} words in unit
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {unitData.games.every(g => g.meets_requirement) ? (
                      <Badge className="bg-success text-success-foreground gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        All Complete
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Incomplete
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleGenerateUnit(unitId)}
                          disabled={generatingUnit === unitId || generatingAll}
                        >
                          {generatingUnit === unitId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3" />
                          )}
                          Generate Unit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {unitData.games.map((stat) => {
                    const isPassageGame = PASSAGE_GAME_TYPES.includes(stat.game_type);
                    const isVocabGame = VOCAB_GAME_TYPES.includes(stat.game_type);
                    const isWordBasedGame = WORD_BASED_GAME_TYPES.includes(stat.game_type);
                    const cardKey = `${stat.unit_id}-${stat.game_id}`;
                    const isExpanded = expandedCards.has(cardKey);
                    
                    let current: number, required: number, label: string;
                    let secondaryInfo: { current: number; required: number; label: string } | null = null;

                    if (isVocabGame) {
                      current = stat.vocab_count - stat.rejected_vocab;
                      required = stat.required_vocab;
                      label = "Vocabulary";
                    } else if (isPassageGame) {
                      current = stat.passage_count - stat.rejected_passages;
                      required = stat.required_passages;
                      label = "Passages";
                      if (stat.required_questions > 0) {
                        secondaryInfo = {
                          current: stat.question_count - stat.rejected_questions,
                          required: stat.required_questions,
                          label: "Questions"
                        };
                      }
                    } else {
                      current = stat.question_count - stat.rejected_questions;
                      required = stat.required_questions;
                      label = "Questions";
                    }

                    const percentage = required > 0 ? Math.min((current / required) * 100, 100) : 100;

                    return (
                      <div
                        key={stat.game_id}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isVocabGame ? (
                              <Sparkles className="h-4 w-4 text-primary" />
                            ) : isPassageGame ? (
                              <BookOpen className="h-4 w-4 text-primary" />
                            ) : (
                              <FileQuestion className="h-4 w-4 text-primary" />
                            )}
                            <span className="font-medium">{stat.game_name}</span>
                          </div>
                          {stat.meets_requirement ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={current >= required ? 'text-success' : 'text-muted-foreground'}>
                              {current} / {required}
                            </span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className="h-2"
                          />
                        </div>

                        {secondaryInfo && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{secondaryInfo.label}</span>
                              <span className={secondaryInfo.current >= secondaryInfo.required ? 'text-success' : 'text-muted-foreground'}>
                                {secondaryInfo.current} / {secondaryInfo.required}
                              </span>
                            </div>
                            <Progress 
                              value={secondaryInfo.required > 0 ? Math.min((secondaryInfo.current / secondaryInfo.required) * 100, 100) : 100} 
                              className="h-2"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1 pt-2 border-t">
                          {isVocabGame ? (
                            <>
                              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                                ✓ {stat.approved_vocab}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                ⏳ {stat.pending_vocab}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                                ✗ {stat.rejected_vocab}
                              </Badge>
                            </>
                          ) : isPassageGame ? (
                            <>
                              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                                ✓ {stat.approved_passages}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                ⏳ {stat.pending_passages}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                                ✗ {stat.rejected_passages}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                                ✓ {stat.approved_questions}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                ⏳ {stat.pending_questions}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                                ✗ {stat.rejected_questions}
                              </Badge>
                            </>
                          )}
                          
                          {!stat.meets_requirement && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-auto h-6 text-xs gap-1"
                              onClick={() => handleGenerate(stat)}
                              disabled={generatingFor === `${stat.unit_id}-${stat.game_id}`}
                            >
                              {generatingFor === `${stat.unit_id}-${stat.game_id}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wand2 className="h-3 w-3" />
                              )}
                              Generate
                            </Button>
                          )}
                        </div>

                        {/* Word-level breakdown for word-based games */}
                        {isWordBasedGame && stat.questionsByWord && stat.questionsByWord.length > 0 && (
                          <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(cardKey)}>
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full h-7 text-xs justify-between px-2 mt-2"
                              >
                                <span>Questions by Word</span>
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-2 bg-muted/30">
                                {stat.questionsByWord.map((wordStat) => {
                                  const nonRejected = wordStat.total - wordStat.rejected;
                                  const meetsReq = nonRejected >= wordStat.required;
                                  return (
                                    <div 
                                      key={wordStat.word}
                                      className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50"
                                    >
                                      <span className={`font-medium ${meetsReq ? '' : 'text-warning'}`}>
                                        {wordStat.word}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className={`${meetsReq ? 'text-success' : 'text-muted-foreground'}`}>
                                          {nonRejected}/{wordStat.required}
                                        </span>
                                        <div className="flex gap-1">
                                          {wordStat.approved > 0 && (
                                            <span className="text-success">✓{wordStat.approved}</span>
                                          )}
                                          {wordStat.pending > 0 && (
                                            <span className="text-muted-foreground">⏳{wordStat.pending}</span>
                                          )}
                                          {wordStat.rejected > 0 && (
                                            <span className="text-destructive">✗{wordStat.rejected}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
