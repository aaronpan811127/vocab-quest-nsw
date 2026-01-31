import { useState, useEffect } from "react";
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

interface Question {
  id: string;
  question_text: string;
  correct_answer: string;
  options: string[] | string | null;
  word: string | null;
  review_status: string;
  review_score: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
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
}

// Group questions by passage for reading game types
const groupQuestionsByPassage = (questions: Question[]): { grouped: PassageGroup[]; ungrouped: Question[] } => {
  const passageMap = new Map<string, PassageGroup>();
  const ungrouped: Question[] = [];

  questions.forEach(q => {
    if (q.passage_id && q.passage_content) {
      if (!passageMap.has(q.passage_id)) {
        passageMap.set(q.passage_id, {
          passage_id: q.passage_id,
          passage_title: q.passage_title || 'Reading Passage',
          passage_content: q.passage_content,
          questions: [],
        });
      }
      passageMap.get(q.passage_id)!.questions.push(q);
    } else {
      ungrouped.push(q);
    }
  });

  return {
    grouped: Array.from(passageMap.values()),
    ungrouped,
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
}

export const AdminQuestionReview = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string[]>(["pending"]);
  const [gameTypeFilter, setGameTypeFilter] = useState("all");
  const [testTypeFilter, setTestTypeFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [gameTypes, setGameTypes] = useState<string[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedVocabulary, setSelectedVocabulary] = useState<VocabularyItem | null>(null);
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
  const { toast } = useToast();

  const fetchQuestions = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        status: statusFilter.join(','),
        game_type: gameTypeFilter,
        test_type_id: testTypeFilter,
        unit_id: unitFilter,
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
      // Always update filter options from the response
      if (data.game_types) {
        setGameTypes(data.game_types);
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

  useEffect(() => {
    fetchQuestions();
  }, [statusFilter, gameTypeFilter, testTypeFilter, unitFilter, page]);

  // Reset unit filter when test type changes
  useEffect(() => {
    setUnitFilter("all");
  }, [testTypeFilter]);

  // Get filtered units based on selected test type
  const filteredUnits = !testTypeFilter 
    ? units 
    : units.filter(u => u.test_type_id === testTypeFilter);

  const handleAction = async () => {
    if (!selectedQuestion && !selectedVocabulary) return;
    
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

      const itemType = selectedVocabulary ? "Vocabulary" : "Question";
      const actionLabel = actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : actionType === "edit" ? "updated" : "scored";
      toast({
        title: "Success",
        description: `${itemType} ${actionLabel} successfully`,
      });

      setActionDialogOpen(false);
      setSelectedQuestion(null);
      setSelectedVocabulary(null);
      setRejectionReason("");
      setScore(5);
      setEditOptions([]);
      setEditCorrectAnswer("");
      setEditVocabWord("");
      setEditVocabDefinition("");
      setEditVocabSynonyms("");
      setEditVocabAntonyms("");
      setEditVocabExamples("");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Question Review</h2>
        </div>
        
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

        {/* Other Filters */}
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
          <Select value={gameTypeFilter} onValueChange={(value) => { setGameTypeFilter(value); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Game Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {gameTypes.map(type => (
                <SelectItem key={type} value={type}>{formatGameType(type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            {["pending", "approved", "rejected"].map((status) => (
              <Button
                key={status}
                variant={statusFilter.includes(status) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter(prev => {
                    if (prev.includes(status)) {
                      // Don't allow deselecting all
                      if (prev.length === 1) return prev;
                      return prev.filter(s => s !== status);
                    }
                    return [...prev, status];
                  });
                  setPage(1);
                }}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : gameTypeFilter === 'flashcards' ? (
        // Show vocabulary items for flashcards
        vocabulary.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No vocabulary found with the selected filters
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {vocabulary.map((vocab) => (
              <Card key={vocab.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{vocab.word}</CardTitle>
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
                            <Badge key={idx} variant="secondary">{syn}</Badge>
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
            ))}
          </div>
        )
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No questions found with the selected filters
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Group reading questions by passage */}
          {(() => {
            const { grouped, ungrouped } = groupQuestionsByPassage(questions);
            
            return (
              <>
                {/* Render grouped passage questions */}
                {grouped.map((passageGroup) => (
                  <Card key={passageGroup.passage_id} className="border-2 border-primary/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            {passageGroup.passage_title}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className="font-normal">
                              Unit {passageGroup.questions[0]?.unit_number}: {passageGroup.questions[0]?.unit_title}
                            </Badge>
                            <Badge variant="outline" className="font-normal">{passageGroup.questions[0]?.game_name}</Badge>
                            <Badge variant="outline" className="font-normal">
                              {passageGroup.questions.length} question{passageGroup.questions.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Passage Content */}
                      <Collapsible 
                        open={expandedPassages.has(passageGroup.passage_id)}
                        onOpenChange={() => togglePassage(passageGroup.passage_id)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              View Passage
                            </span>
                            {expandedPassages.has(passageGroup.passage_id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 p-4 bg-muted rounded-lg text-sm max-h-64 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{passageGroup.passage_content}</p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Questions for this passage */}
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {passageGroup.questions.map((question, qIdx) => (
                          <div key={question.id} className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">
                                  Q{qIdx + 1}: {question.question_text}
                                </p>
                                {question.word && (
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs font-normal">Word: {question.word}</Badge>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(question.review_status)}
                                {question.review_score !== null && (
                                  <Badge variant="secondary" className="gap-1 text-xs">
                                    <Star className="h-3 w-3" /> {question.review_score}/10
                                  </Badge>
                                )}
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

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs"
                                onClick={() => openActionDialog(question, "edit")}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs"
                                onClick={() => openActionDialog(question, "approve")}
                              >
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs"
                                onClick={() => openActionDialog(question, "reject")}
                              >
                                <X className="h-3 w-3" /> Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs"
                                onClick={() => openActionDialog(question, "score")}
                              >
                                <Star className="h-3 w-3" /> Score
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Render ungrouped questions (non-reading) */}
                {ungrouped.map((question) => (
                  <Card key={question.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{question.question_text}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className="font-normal">Unit {question.unit_number}: {question.unit_title}</Badge>
                            <Badge variant="outline" className="font-normal">{question.game_name}</Badge>
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
                ))}
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

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className={actionType === "edit" ? "max-w-lg" : ""}>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? (selectedVocabulary ? "Approve Vocabulary" : "Approve Question") : 
               actionType === "reject" ? (selectedVocabulary ? "Reject Vocabulary" : "Reject Question") : 
               actionType === "edit" ? (selectedVocabulary ? "Edit Vocabulary" : "Edit Question") : 
               (selectedVocabulary ? "Score Vocabulary" : "Score Question")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {actionType !== "edit" && (
              <p className="text-sm text-muted-foreground mb-4">
                {selectedQuestion?.question_text || selectedVocabulary?.word}
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