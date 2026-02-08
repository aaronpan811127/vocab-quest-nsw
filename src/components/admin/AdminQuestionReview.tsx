import { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Star, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BookOpen, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface VocabularyItem {
  id: string;
  word: string;
  definition: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  unit_id: string;
  unit_title: string;
  unit_number: number;
  created_at: string;
  review_status: string;
  review_score: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

interface LinkedExtract {
  label: string;
  title: string;
  content: string;
  text_type: string;
}

const parseLinkedExtracts = (content: string): LinkedExtract[] | null => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && 'label' in parsed[0] && 'content' in parsed[0]) {
      return parsed;
    }
  } catch {
    // Not JSON, return null for plain text handling
  }
  return null;
};

interface Question {
  id: string;
  question_text: string;
  correct_answer: string;
  // Can be array, JSON string, or object (e.g. Word Intuition)
  options: unknown;
  word: string | null;
  review_status: string;
  review_score: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  unit_id: string;
  unit_title: string;
  unit_number: number;
  game_name: string;
  game_type: string;
  passage_id: string | null;
  passage_title: string | null;
  passage_content: string | null;
}

const parseOptions = (options: unknown): string[] => {
  if (!options) return [];
  
  // Handle string that needs to be parsed
  let parsed = options;
  if (typeof options === 'string') {
    try {
      parsed = JSON.parse(options);
    } catch {
      return [];
    }
  }
  
  // Handle array of strings
  if (Array.isArray(parsed)) {
    return parsed.map(opt => typeof opt === 'string' ? opt : String(opt));
  }
  
  // Handle object case
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    
    // Handle Word Intuition format: { word, choices, explanation }
    if ('choices' in obj && Array.isArray(obj.choices)) {
      return obj.choices.map((c: unknown) => typeof c === 'string' ? c : String(c));
    }
    
    // Handle indexed object format: { 0: "a", 1: "b" }
    return Object.values(obj).filter((v): v is string => typeof v === 'string');
  }
  
  return [];
};

interface PassageGroup {
  passage_id: string;
  passage_title: string;
  passage_content: string;
  questions: Question[];
  // Aggregate review status for passage-level display
  review_status: string;
  unit_title: string;
  unit_number: number;
  game_name: string;
}

// Sort questions by game type, then group by passage for reading game types
const groupQuestionsByPassage = (questions: Question[]): { grouped: PassageGroup[]; ungrouped: Question[] } => {
  // First, sort questions by game_name to group same game types together
  const sortedQuestions = [...questions].sort((a, b) => {
    const gameCompare = a.game_name.localeCompare(b.game_name);
    if (gameCompare !== 0) return gameCompare;
    // Within same game, sort by unit number
    return a.unit_number - b.unit_number;
  });

  const passageMap = new Map<string, PassageGroup>();
  const ungrouped: Question[] = [];

  sortedQuestions.forEach(q => {
    if (q.passage_id && q.passage_content) {
      if (!passageMap.has(q.passage_id)) {
        passageMap.set(q.passage_id, {
          passage_id: q.passage_id,
          passage_title: q.passage_title || 'Reading Passage',
          passage_content: q.passage_content,
          questions: [],
          review_status: q.review_status,
          unit_title: q.unit_title,
          unit_number: q.unit_number,
          game_name: q.game_name,
        });
      }
      passageMap.get(q.passage_id)!.questions.push(q);
    } else {
      ungrouped.push(q);
    }
  });

  // Calculate aggregate review status for each passage
  passageMap.forEach((group) => {
    const statuses = group.questions.map(q => q.review_status);
    if (statuses.every(s => s === 'approved')) {
      group.review_status = 'approved';
    } else if (statuses.some(s => s === 'rejected')) {
      group.review_status = 'rejected';
    } else {
      group.review_status = 'pending';
    }
  });

  // Sort grouped passages by game name, then unit number
  const sortedGrouped = Array.from(passageMap.values()).sort((a, b) => {
    const gameCompare = a.game_name.localeCompare(b.game_name);
    if (gameCompare !== 0) return gameCompare;
    return a.unit_number - b.unit_number;
  });

  // Sort ungrouped questions by game name, then unit number
  const sortedUngrouped = ungrouped.sort((a, b) => {
    const gameCompare = a.game_name.localeCompare(b.game_name);
    if (gameCompare !== 0) return gameCompare;
    return a.unit_number - b.unit_number;
  });

  return {
    grouped: sortedGrouped,
    ungrouped: sortedUngrouped,
  };
};

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
  words?: string[] | unknown;
}

export const AdminQuestionReview = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [gameTypeFilter, setGameTypeFilter] = useState("");
  const [testTypeFilter, setTestTypeFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [gameTypes, setGameTypes] = useState<{ type: string; name: string }[]>([]);
  const [gameTypesWithContent, setGameTypesWithContent] = useState<string[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsWithContent, setUnitsWithContent] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPassages, setTotalPassages] = useState(0);
  const [isPassageBased, setIsPassageBased] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedVocabulary, setSelectedVocabulary] = useState<VocabularyItem | null>(null);
  const [selectedPassage, setSelectedPassage] = useState<PassageGroup | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "score" | "edit">("approve");
  const [score, setScore] = useState(5);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedPassages, setExpandedPassages] = useState<Set<string>>(new Set());
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState("");
  // Vocabulary edit state
  const [editVocabWord, setEditVocabWord] = useState("");
  const [editVocabDefinition, setEditVocabDefinition] = useState("");
  const [editVocabSynonyms, setEditVocabSynonyms] = useState("");
  const [editVocabAntonyms, setEditVocabAntonyms] = useState("");
  const [editVocabExamples, setEditVocabExamples] = useState("");
  // Passage edit state
  const [editPassageTitle, setEditPassageTitle] = useState("");
  const [editPassageContent, setEditPassageContent] = useState("");
  const [editLinkedExtracts, setEditLinkedExtracts] = useState<LinkedExtract[]>([]);
  const [isLinkedExtracts, setIsLinkedExtracts] = useState(false);
  const [showCurrentVocabOnly, setShowCurrentVocabOnly] = useState(true);
  const { toast } = useToast();

  const fetchQuestions = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        status: statusFilter,
        game_type: gameTypeFilter,
        test_type_id: testTypeFilter,
        unit_id: unitFilter,
        active_vocab_only: showCurrentVocabOnly.toString(),
        page: page.toString(),
        limit: '20'
      });

      const fullResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-questions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await fullResponse.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setQuestions(data.questions || []);
      setVocabulary(data.vocabulary || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
      setTotalPassages(data.total_passages || 0);
      setIsPassageBased(data.is_passage_based || false);
      // Always update filter options from the response
      if (data.game_types_with_names) {
        const nextGameTypes = data.game_types_with_names as { type: string; name: string }[];
        setGameTypes(nextGameTypes);

        const nextGameTypesWithContent = (data.game_types_with_content || []) as string[];
        setGameTypesWithContent(nextGameTypesWithContent);

        // Default game type: pick first available (respecting "with_content" when present)
        const availableGameTypes =
          nextGameTypesWithContent.length > 0
            ? nextGameTypes.filter((g) => nextGameTypesWithContent.includes(g.type))
            : nextGameTypes;

        if (availableGameTypes.length > 0) {
          const isCurrentValid = availableGameTypes.some((g) => g.type === gameTypeFilter);
          if (!gameTypeFilter || !isCurrentValid) {
            setGameTypeFilter(availableGameTypes[0].type);
          }
        }
      }
      if (data.test_types) {
        setTestTypes(data.test_types);
        // Default to Selective test type if not already set
        if (!testTypeFilter && data.test_types.length > 0) {
          const selectiveType = data.test_types.find((t: TestType) => t.code === 'SELECTIVE');
          if (selectiveType) {
            setTestTypeFilter(selectiveType.id);
          } else {
            setTestTypeFilter(data.test_types[0].id);
          }
        }
      }
      if (data.units) {
        setUnits(data.units);
      }
      if (data.units_with_content) {
        setUnitsWithContent(data.units_with_content);
      }
      // game_types_with_content is handled above together with game_types_with_names
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch questions",
        variant: "destructive",
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Track initial mount to prevent double-fetch from cascading resets
  const isInitialMount = useRef(true);
  const isTestTypeInitializing = useRef(true);

  useEffect(() => {
    // Skip fetch if we're still in initial cascade of filter resets
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchQuestions();
  }, [statusFilter, gameTypeFilter, testTypeFilter, unitFilter, showCurrentVocabOnly, page]);

  // Initial fetch on mount
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Reset unit and game type filters when test type changes (skip on initial set)
  useEffect(() => {
    if (isTestTypeInitializing.current) {
      isTestTypeInitializing.current = false;
      return;
    }
    setUnitFilter("all");
    // Clear so fetch can default to first available game type for new context
    setGameTypeFilter("");
    setPage(1);
  }, [testTypeFilter]);

  // Reset game type filter when unit filter changes
  useEffect(() => {
    // Only reset if unit actually changed by user (not initial "all")
    if (unitFilter === "all") return;
    // Clear so fetch can default to first available game type for new context
    setGameTypeFilter("");
  }, [unitFilter]);

  // Get filtered units based on selected test type AND which units have content matching current status
  const filteredUnits = useMemo(() => {
    // First filter by test type
    const testTypeFiltered = !testTypeFilter 
      ? units 
      : units.filter(u => u.test_type_id === testTypeFilter);
    
    // If no units with content data, show all units for the test type
    if (unitsWithContent.length === 0) {
      return testTypeFiltered;
    }
    
    // Filter units to only those with content matching current filters
    const unitsWithContentSet = new Set(unitsWithContent);
    return testTypeFiltered.filter(u => unitsWithContentSet.has(u.id));
  }, [units, testTypeFilter, unitsWithContent]);

  // Get filtered game types based on which game types have content matching current status/unit
  const filteredGameTypes = useMemo(() => {
    // If no game types with content data, show all game types
    if (gameTypesWithContent.length === 0) {
      return gameTypes;
    }
    
    // Filter game types to only those with content matching current filters
    const gameTypesWithContentSet = new Set(gameTypesWithContent);
    return gameTypes.filter(g => gameTypesWithContentSet.has(g.type));
  }, [gameTypes, gameTypesWithContent]);

  const handleAction = async () => {
    if (!selectedQuestion && !selectedVocabulary && !selectedPassage) return;
    
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body: Record<string, unknown> = {
        action: actionType,
      };

      // Set the ID based on what's selected
      if (selectedVocabulary) {
        body.vocabulary_id = selectedVocabulary.id;
      } else if (selectedPassage) {
        // Passage-level action - send passage_id for bulk update
        body.passage_id = selectedPassage.passage_id;
      } else if (selectedQuestion) {
        body.question_id = selectedQuestion.id;
      }

      if (actionType === "score") {
        body.score = score;
      } else if (actionType === "reject") {
        body.rejection_reason = rejectionReason;
      } else if (actionType === "edit") {
        if (selectedVocabulary) {
          // Vocabulary edit
          body.vocabulary_data = {
            word: editVocabWord,
            definition: editVocabDefinition,
            synonyms: editVocabSynonyms.split(',').map(s => s.trim()).filter(s => s),
            antonyms: editVocabAntonyms.split(',').map(s => s.trim()).filter(s => s),
            examples: editVocabExamples.split('\n').map(s => s.trim()).filter(s => s),
          };
        } else if (selectedPassage) {
          // Passage edit
          body.passage_data = {
            title: editPassageTitle,
            content: isLinkedExtracts ? JSON.stringify(editLinkedExtracts) : editPassageContent,
          };
        } else {
          // Question edit
          body.options = editOptions;
          body.correct_answer = editCorrectAnswer;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-review-question`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const itemType = selectedVocabulary ? "Vocabulary" : selectedPassage ? "Passage" : "Question";
      const actionLabel = actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : actionType === "edit" ? "updated" : "scored";
      toast({
        title: "Success",
        description: `${itemType} ${actionLabel} successfully`,
      });

      setActionDialogOpen(false);
      setSelectedQuestion(null);
      setSelectedVocabulary(null);
      setSelectedPassage(null);
      setRejectionReason("");
      setScore(5);
      setEditOptions([]);
      setEditCorrectAnswer("");
      setEditVocabWord("");
      setEditVocabDefinition("");
      setEditVocabSynonyms("");
      setEditVocabAntonyms("");
      setEditVocabExamples("");
      setEditPassageTitle("");
      setEditPassageContent("");
      setEditLinkedExtracts([]);
      setIsLinkedExtracts(false);
      fetchQuestions(false);
    } catch (error) {
      console.error('Error reviewing:', error);
      toast({
        title: "Error",
        description: "Failed to review item",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (question: Question, action: "approve" | "reject" | "score" | "edit") => {
    setSelectedQuestion(question);
    setSelectedVocabulary(null);
    setSelectedPassage(null);
    setActionType(action);
    if (action === "edit") {
      setEditOptions(parseOptions(question.options));
      setEditCorrectAnswer(question.correct_answer);
    }
    setActionDialogOpen(true);
  };

  const openVocabActionDialog = (vocab: VocabularyItem, action: "approve" | "reject" | "score" | "edit") => {
    setSelectedVocabulary(vocab);
    setSelectedQuestion(null);
    setSelectedPassage(null);
    setActionType(action);
    if (action === "edit") {
      setEditVocabWord(vocab.word);
      setEditVocabDefinition(vocab.definition);
      setEditVocabSynonyms(vocab.synonyms?.join(', ') || '');
      setEditVocabAntonyms(vocab.antonyms?.join(', ') || '');
      setEditVocabExamples(vocab.examples?.join('\n') || '');
    }
    setActionDialogOpen(true);
  };

  const openPassageActionDialog = (passage: PassageGroup, action: "approve" | "reject" | "edit") => {
    setSelectedPassage(passage);
    setSelectedQuestion(null);
    setSelectedVocabulary(null);
    setActionType(action);
    if (action === "edit") {
      setEditPassageTitle(passage.passage_title);
      const extracts = parseLinkedExtracts(passage.passage_content);
      if (extracts) {
        setIsLinkedExtracts(true);
        setEditLinkedExtracts(extracts);
        setEditPassageContent("");
      } else {
        setIsLinkedExtracts(false);
        setEditLinkedExtracts([]);
        setEditPassageContent(passage.passage_content);
      }
    }
    setActionDialogOpen(true);
  };

  const handleExtractChange = (index: number, field: keyof LinkedExtract, value: string) => {
    setEditLinkedExtracts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...editOptions];
    newOptions[index] = value;
    setEditOptions(newOptions);
  };

  const togglePassage = (questionId: string) => {
    setExpandedPassages(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatGameType = (gameType: string) => {
    return gameType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Active vocab filtering is now done server-side via the active_vocab_only parameter

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        
        {/* Test Type Radio Buttons */}
        <RadioGroup 
          value={testTypeFilter} 
          onValueChange={(value) => { setTestTypeFilter(value); setPage(1); }}
          className="flex flex-wrap gap-3"
        >
          {testTypes.map(type => (
            <div key={type.id} className="flex items-center space-x-2">
              <RadioGroupItem value={type.id} id={`test-type-${type.id}`} />
              <Label htmlFor={`test-type-${type.id}`} className="cursor-pointer text-sm font-medium">
                {type.name}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Status Filter - single selection radio buttons */}
        <RadioGroup
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            // Cascade: reset downstream filters
            setUnitFilter('all');
            setGameTypeFilter('');
            setPage(1);
          }}
          className="flex items-center gap-2"
        >
          {["pending", "approved", "rejected"].map((status) => (
            <div key={status} className="flex items-center space-x-1">
              <RadioGroupItem value={status} id={`status-${status}`} />
              <Label htmlFor={`status-${status}`} className="capitalize cursor-pointer">
                {status}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Unit and Game Type Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={unitFilter} onValueChange={(value) => { setUnitFilter(value); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {filteredUnits.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>Unit {unit.unit_number}: {unit.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RadioGroup 
            value={gameTypeFilter} 
            onValueChange={(value) => { setGameTypeFilter(value); setPage(1); }}
            className="flex flex-wrap gap-3"
          >
            {filteredGameTypes.map(g => (
              <div key={g.type} className="flex items-center space-x-2">
                <RadioGroupItem value={g.type} id={`game-type-${g.type}`} />
                <Label htmlFor={`game-type-${g.type}`} className="cursor-pointer text-sm font-medium">
                  {g.name}
                </Label>
              </div>
            ))}
          </RadioGroup>
          
          {/* Current Vocab Toggle - hide for passage-based games */}
          {!isPassageBased && gameTypeFilter !== 'reading' && gameTypeFilter !== 'linked_extracts' && (
            <div className="flex items-center gap-2">
              <Switch
                id="current-vocab-toggle"
                checked={showCurrentVocabOnly}
                onCheckedChange={setShowCurrentVocabOnly}
              />
              <Label htmlFor="current-vocab-toggle" className="cursor-pointer text-sm font-medium">
                Active Vocab in Units Only
              </Label>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : gameTypeFilter === 'flashcards' ? (
        // Show vocabulary items for flashcards
        (() => {
          // Vocabulary is already filtered server-side based on active_vocab_only parameter
          return vocabulary.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No vocabulary found with the selected filters
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Total count display */}
              <div className="text-sm text-muted-foreground">
                Showing {vocabulary.length} of {totalCount} total vocabulary items
              </div>
              {vocabulary.map((vocab, vocabIdx) => {
                const pageOffset = (page - 1) * 20;
                const itemNumber = pageOffset + vocabIdx + 1;
                return (
                <Card key={vocab.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">#{itemNumber}: {vocab.word}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline">Unit {vocab.unit_number}: {vocab.unit_title}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(vocab.review_status || 'pending')}
                      {vocab.review_score !== null && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" /> {vocab.review_score}/10
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Definition:</p>
                      <p className="text-base">{vocab.definition}</p>
                    </div>
                    
                    {vocab.synonyms && vocab.synonyms.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Synonyms:</p>
                        <div className="flex flex-wrap gap-2">
                          {vocab.synonyms.map((syn, idx) => (
                            <Badge key={idx} variant="outline">{syn}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {vocab.antonyms && vocab.antonyms.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Antonyms:</p>
                        <div className="flex flex-wrap gap-2">
                          {vocab.antonyms.map((ant, idx) => (
                            <Badge key={idx} variant="outline">{ant}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {vocab.examples && vocab.examples.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Examples:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {vocab.examples.map((ex, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground italic">{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {vocab.rejection_reason && (
                      <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                        Rejection reason: {vocab.rejection_reason}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openVocabActionDialog(vocab, "edit")}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openVocabActionDialog(vocab, "approve")}
                      >
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openVocabActionDialog(vocab, "reject")}
                      >
                        <X className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openVocabActionDialog(vocab, "score")}
                      >
                        <Star className="h-4 w-4" /> Score
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
              })}
          </div>
          );
        })()
      ) : questions.length === 0 && vocabulary.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No questions found with the selected filters
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Group all content by game type for proper ordering */}
          {(() => {
            // Questions are already filtered server-side based on active_vocab_only parameter
            const { grouped, ungrouped } = groupQuestionsByPassage(questions);
            const displayedCount = grouped.reduce((sum, p) => sum + p.questions.length, 0) + ungrouped.length;
            
            // Group passages by game_name
            const passagesByGame = grouped.reduce((acc, pg) => {
              if (!acc[pg.game_name]) acc[pg.game_name] = [];
              acc[pg.game_name].push(pg);
              return acc;
            }, {} as Record<string, PassageGroup[]>);

            // Group ungrouped questions by game_name
            const ungroupedByGame = ungrouped.reduce((acc, q) => {
              if (!acc[q.game_name]) acc[q.game_name] = [];
              acc[q.game_name].push(q);
              return acc;
            }, {} as Record<string, Question[]>);

            // Build ordered list of game types alphabetically
            const questionGameNames = [...new Set([...Object.keys(passagesByGame), ...Object.keys(ungroupedByGame)])].sort();
            const allGameSections: { gameName: string }[] = [];
            
            // Add all question game types
            questionGameNames.forEach(gameName => {
              allGameSections.push({ gameName });
            });

            // Calculate page offset for passage numbering across pages
            const passagePageOffset = (page - 1) * 20; // Approximate based on page
            let passageSequenceNumber = passagePageOffset;

            return (
              <>
                {/* Total count display */}
                <div className="text-sm text-muted-foreground mb-4">
                  {isPassageBased ? (
                    <>Showing {grouped.length} of {totalPassages} total passages ({displayedCount} questions)</>
                  ) : (
                    <>Showing {displayedCount} of {totalCount} total questions</>
                  )}
                </div>
                {allGameSections.map((section) => {
              // Render Questions section for this game type
              const gameName = section.gameName;
              const passages = passagesByGame[gameName] || [];
              const ungroupedQuestions = ungroupedByGame[gameName] || [];
              const totalItems = passages.reduce((sum, p) => sum + p.questions.length, 0) + ungroupedQuestions.length;

              return (
                <div key={gameName} className="space-y-4">
                  {/* Game type header */}
                  <h4 className="text-md font-semibold flex items-center gap-2 mt-4 border-b pb-2">
                    <Badge variant="secondary" className="text-sm px-3 py-1">{gameName}</Badge>
                  </h4>

                  {/* Render grouped passage questions for this game */}
                  {passages.map((passageGroup, pIdx) => {
                    passageSequenceNumber++;
                    return (
                    <Card key={passageGroup.passage_id} className="border-2 border-primary/20">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-primary" />
                              <span className="text-primary font-semibold">P{passageSequenceNumber} of {totalPassages}:</span> {passageGroup.passage_title}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="font-normal">
                                Unit {passageGroup.unit_number}: {passageGroup.unit_title}
                              </Badge>
                              <Badge variant="outline" className="font-normal">
                                {passageGroup.questions.length} question{passageGroup.questions.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(passageGroup.review_status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Passage-level actions */}
                        <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <span className="text-sm font-medium text-muted-foreground mr-2 self-center">Passage Actions:</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openPassageActionDialog(passageGroup, "edit")}
                          >
                            <Pencil className="h-4 w-4" /> Edit Passage
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openPassageActionDialog(passageGroup, "approve")}
                          >
                            <Check className="h-4 w-4" /> Approve All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openPassageActionDialog(passageGroup, "reject")}
                          >
                            <X className="h-4 w-4" /> Reject All
                          </Button>
                        </div>

                        {/* Passage Content */}
                        <Collapsible 
                          open={expandedPassages.has(passageGroup.passage_id)}
                          onOpenChange={() => togglePassage(passageGroup.passage_id)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-between gap-2">
                              <span className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                {expandedPassages.has(passageGroup.passage_id) ? "Hide Extract" : "Show Extract"}
                              </span>
                              {expandedPassages.has(passageGroup.passage_id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 space-y-3">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(passageGroup.passage_content);

                                  // Linked Extracts format: array of { label, title, content }
                                  if (Array.isArray(parsed)) {
                                    return parsed.map((extract: { label?: string; title?: string; content?: string }, idx: number) => (
                                      <div key={idx} className="p-3 bg-muted rounded-lg border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                          {extract.label && (
                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded">
                                              {extract.label}
                                            </span>
                                          )}
                                          {extract.title && (
                                            <span className="font-medium text-sm">{extract.title}</span>
                                          )}
                                        </div>
                                        {extract.content && (
                                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{extract.content}</p>
                                        )}
                                      </div>
                                    ));
                                  }

                                  // Gap Fill / Cloze Passage format: { passage, options, answers }
                                  if (parsed && typeof parsed === 'object' && parsed.passage) {
                                    // Render passage with highlighted [Gap X] markers
                                    const renderPassageWithGaps = (text: string) => {
                                      const parts = text.split(/(\[Gap \d+\])/g);
                                      return parts.map((part, i) => {
                                        const gapMatch = part.match(/^\[Gap (\d+)\]$/);
                                        if (gapMatch) {
                                          const gapNum = gapMatch[1];
                                          const answerLabel = parsed.answers?.[gapNum];
                                          const answerOption = answerLabel && parsed.options?.find((o: { label?: string }) => o.label === answerLabel);
                                          return (
                                            <span
                                              key={i}
                                              className="inline-flex items-center px-2 py-0.5 mx-0.5 bg-primary/15 border border-primary/30 text-primary text-xs font-bold rounded"
                                              title={answerOption ? `Answer: ${answerLabel} – ${answerOption.text}` : undefined}
                                            >
                                              Gap {gapNum}
                                            </span>
                                          );
                                        }
                                        return <span key={i}>{part}</span>;
                                      });
                                    };

                                    return (
                                      <div className="space-y-4">
                                        <div className="p-4 bg-muted rounded-lg">
                                          <p className="text-sm font-medium text-muted-foreground mb-2">Passage:</p>
                                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{renderPassageWithGaps(parsed.passage)}</p>
                                        </div>
                                        {parsed.options && Array.isArray(parsed.options) && (
                                          <div className="p-4 bg-muted rounded-lg">
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Options ({parsed.options.length}):</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              {parsed.options.map((opt: { label?: string; text?: string }, idx: number) => {
                                                const label = opt.label || String.fromCharCode(65 + idx);
                                                const isUsed = parsed.answers && Object.values(parsed.answers).includes(label);
                                                return (
                                                  <div key={idx} className={`flex gap-2 text-sm p-2 rounded-md border ${isUsed ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-background/50'}`}>
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded shrink-0 ${isUsed ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
                                                      {label}
                                                    </span>
                                                    <span className="text-foreground">{opt.text}</span>
                                                    {!isUsed && <Badge variant="outline" className="text-[10px] ml-auto shrink-0">distractor</Badge>}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        {parsed.answers && typeof parsed.answers === 'object' && (
                                          <div className="p-4 bg-muted rounded-lg">
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Answer Key:</p>
                                            <div className="flex flex-wrap gap-2">
                                              {Object.entries(parsed.answers).map(([gap, label]) => {
                                                const opt = parsed.options?.find((o: { label?: string }) => o.label === label);
                                                return (
                                                  <Badge key={gap} variant="outline" className="text-xs py-1">
                                                    Gap {gap} → <span className="font-bold text-primary ml-1">{String(label)}</span>
                                                    {opt && <span className="ml-1 text-muted-foreground truncate max-w-[120px]">({(opt as { text?: string }).text})</span>}
                                                  </Badge>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  return <p className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">{passageGroup.passage_content}</p>;
                                } catch {
                                  return <p className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">{passageGroup.passage_content}</p>;
                                }
                              })()}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Questions for this passage - only Edit at question level */}
                        <div className="space-y-3 pl-4 border-l-2 border-muted">
                          {passageGroup.questions.map((question, qIdx) => (
                            <div key={question.id} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    Q{qIdx + 1}: {question.question_text}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  {getStatusBadge(question.review_status)}
                                </div>
                              </div>

                              <div className="mb-2">
                                <p className="text-xs text-muted-foreground mb-1">Options:</p>
                                <div className="flex flex-wrap gap-1">
                                  {parseOptions(question.options).map((option: string, idx: number) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className={`text-xs font-normal ${option === question.correct_answer ? "bg-success text-success-foreground border-success" : ""}`}
                                    >
                                      {option}
                                      {option === question.correct_answer && " ✓"}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {question.rejection_reason && (
                                <div className="p-2 bg-destructive/10 rounded text-xs text-destructive mb-2">
                                  Rejection reason: {question.rejection_reason}
                                </div>
                              )}

                              {/* Only Edit available at question level */}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-7 text-xs"
                                  onClick={() => openActionDialog(question, "edit")}
                                >
                                  <Pencil className="h-3 w-3" /> Edit Question
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                  })}

                  {/* Render ungrouped questions for this game */}
                  {ungroupedQuestions.map((question, qIdx) => {
                    const pageOffset = (page - 1) * 20;
                    const itemNumber = pageOffset + qIdx + 1;
                    return (
                    <Card key={question.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">#{itemNumber}: {question.question_text}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="font-normal">Unit {question.unit_number}: {question.unit_title}</Badge>
                              {question.word && <Badge variant="outline" className="font-normal">Word: {question.word}</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(question.review_status)}
                            {question.review_score !== null && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="h-3 w-3" /> {question.review_score}/10
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Options:</p>
                            <div className="flex flex-wrap gap-2">
                              {parseOptions(question.options).map((option: string, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={`font-normal ${option === question.correct_answer ? "bg-success text-success-foreground border-success" : ""}`}
                                >
                                  {option}
                                  {option === question.correct_answer && " ✓"}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {question.rejection_reason && (
                            <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                              Rejection reason: {question.rejection_reason}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openActionDialog(question, "edit")}
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openActionDialog(question, "approve")}
                            >
                              <Check className="h-4 w-4" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openActionDialog(question, "reject")}
                            >
                              <X className="h-4 w-4" /> Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openActionDialog(question, "score")}
                            >
                              <Star className="h-4 w-4" /> Score
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              );
            })}
              </>
            );
          })()}

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className={actionType === "edit" ? (selectedPassage && isLinkedExtracts ? "max-w-3xl max-h-[80vh] overflow-y-auto" : "max-w-lg") : ""}>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? (
                selectedVocabulary ? "Approve Vocabulary" : 
                selectedPassage ? "Approve Passage" : "Approve Question"
              ) : actionType === "reject" ? (
                selectedVocabulary ? "Reject Vocabulary" : 
                selectedPassage ? "Reject Passage" : "Reject Question"
              ) : actionType === "edit" ? (
                selectedVocabulary ? "Edit Vocabulary" : 
                selectedPassage ? "Edit Passage" : "Edit Question"
              ) : (
                selectedVocabulary ? "Score Vocabulary" : "Score Question"
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {actionType !== "edit" && (
              <p className="text-sm text-muted-foreground mb-4">
                {selectedQuestion?.question_text || selectedVocabulary?.word || (
                  selectedPassage && (
                    <span>
                      <strong>{selectedPassage.passage_title}</strong>
                      <br />
                      <span className="text-xs">
                        This will {actionType} all {selectedPassage.questions.length} questions in this passage.
                      </span>
                    </span>
                  )
                )}
              </p>
            )}

            {actionType === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Enter reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            {actionType === "score" && (
              <div className="space-y-2">
                <Label htmlFor="score">Score (0-10)</Label>
                <Input
                  id="score"
                  type="number"
                  min={0}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                />
              </div>
            )}

            {actionType === "edit" && selectedVocabulary && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-word">Word</Label>
                  <Input
                    id="edit-word"
                    value={editVocabWord}
                    onChange={(e) => setEditVocabWord(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-definition">Definition</Label>
                  <Textarea
                    id="edit-definition"
                    value={editVocabDefinition}
                    onChange={(e) => setEditVocabDefinition(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-synonyms">Synonyms (comma-separated)</Label>
                  <Input
                    id="edit-synonyms"
                    value={editVocabSynonyms}
                    onChange={(e) => setEditVocabSynonyms(e.target.value)}
                    placeholder="e.g. happy, joyful, pleased"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-antonyms">Antonyms (comma-separated)</Label>
                  <Input
                    id="edit-antonyms"
                    value={editVocabAntonyms}
                    onChange={(e) => setEditVocabAntonyms(e.target.value)}
                    placeholder="e.g. sad, unhappy, gloomy"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-examples">Examples (one per line)</Label>
                  <Textarea
                    id="edit-examples"
                    value={editVocabExamples}
                    onChange={(e) => setEditVocabExamples(e.target.value)}
                    rows={3}
                    placeholder="Enter example sentences, one per line"
                  />
                </div>
              </div>
            )}

            {actionType === "edit" && selectedPassage && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-passage-title">Passage Title</Label>
                  <Input
                    id="edit-passage-title"
                    value={editPassageTitle}
                    onChange={(e) => setEditPassageTitle(e.target.value)}
                  />
                </div>
                
                {isLinkedExtracts ? (
                  <div className="space-y-4">
                    <Label>Linked Extracts</Label>
                    {editLinkedExtracts.map((extract, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{extract.label}</Badge>
                            <span className="text-xs text-muted-foreground">{extract.text_type}</span>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`extract-title-${idx}`}>Title</Label>
                            <Input
                              id={`extract-title-${idx}`}
                              value={extract.title}
                              onChange={(e) => handleExtractChange(idx, 'title', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`extract-content-${idx}`}>Content</Label>
                            <Textarea
                              id={`extract-content-${idx}`}
                              value={extract.content}
                              onChange={(e) => handleExtractChange(idx, 'content', e.target.value)}
                              rows={5}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`extract-type-${idx}`}>Text Type</Label>
                            <Input
                              id={`extract-type-${idx}`}
                              value={extract.text_type}
                              onChange={(e) => handleExtractChange(idx, 'text_type', e.target.value)}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="edit-passage-content">Passage Content</Label>
                    <Textarea
                      id="edit-passage-content"
                      value={editPassageContent}
                      onChange={(e) => setEditPassageContent(e.target.value)}
                      rows={10}
                    />
                  </div>
                )}
              </div>
            )}

            {actionType === "edit" && selectedQuestion && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="space-y-2">
                    {editOptions.map((option, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant={editCorrectAnswer === option ? "default" : "outline"}
                          className={editCorrectAnswer === option ? "bg-success hover:bg-success/90" : ""}
                          onClick={() => setEditCorrectAnswer(option)}
                        >
                          {editCorrectAnswer === option ? <Check className="h-4 w-4" /> : "Set Correct"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click "Set Correct" to mark an option as the correct answer.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                actionType === "approve" ? "Approve" : 
                actionType === "reject" ? "Reject" : 
                actionType === "edit" ? "Save Changes" : "Save Score"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};