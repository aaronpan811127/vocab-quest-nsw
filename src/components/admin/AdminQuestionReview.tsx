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
import { Check, X, Star, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BookOpen, Sparkles } from "lucide-react";

interface Vocabulary {
  definition: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
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
  vocabulary: Vocabulary | null;
}

const parseOptions = (options: string[] | string | null): string[] => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [gameTypeFilter, setGameTypeFilter] = useState("all");
  const [testTypeFilter, setTestTypeFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [gameTypes, setGameTypes] = useState<string[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "score">("approve");
  const [score, setScore] = useState(5);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedPassages, setExpandedPassages] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        status: statusFilter,
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
      setLoading(false);
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
    if (!selectedQuestion) return;
    
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body: Record<string, unknown> = {
        question_id: selectedQuestion.id,
        action: actionType,
      };

      if (actionType === "score") {
        body.score = score;
      } else if (actionType === "reject") {
        body.rejection_reason = rejectionReason;
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

      toast({
        title: "Success",
        description: `Question ${actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : "scored"} successfully`,
      });

      setActionDialogOpen(false);
      setSelectedQuestion(null);
      setRejectionReason("");
      setScore(5);
      fetchQuestions();
    } catch (error) {
      console.error('Error reviewing question:', error);
      toast({
        title: "Error",
        description: "Failed to review question",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (question: Question, action: "approve" | "reject" | "score") => {
    setSelectedQuestion(question);
    setActionType(action);
    setActionDialogOpen(true);
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
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No questions found with the selected filters
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <Card key={question.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{question.question_text}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline">Unit {question.unit_number}: {question.unit_title}</Badge>
                      <Badge variant="outline">{question.game_name}</Badge>
                      <Badge variant="secondary">{formatGameType(question.game_type)}</Badge>
                      {question.word && <Badge variant="outline">Word: {question.word}</Badge>}
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
                  {/* Reading Passage for reading questions */}
                  {question.passage_content && (
                    <Collapsible 
                      open={expandedPassages.has(question.id)}
                      onOpenChange={() => togglePassage(question.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            {question.passage_title || "Reading Passage"}
                          </span>
                          {expandedPassages.has(question.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 p-4 bg-muted rounded-lg text-sm max-h-64 overflow-y-auto">
                          <p className="whitespace-pre-wrap">{question.passage_content}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Options:</p>
                    <div className="flex flex-wrap gap-2">
                      {parseOptions(question.options).map((option: string, idx: number) => (
                        <Badge
                          key={idx}
                          variant={option === question.correct_answer ? "default" : "secondary"}
                          className={option === question.correct_answer ? "bg-success text-success-foreground" : ""}
                        >
                          {option}
                          {option === question.correct_answer && " ✓"}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* AI Generated Vocabulary Content */}
                  {question.vocabulary && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Sparkles className="h-4 w-4" />
                        AI Generated Content
                      </div>
                      <div className="grid gap-2 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Definition:</span>{" "}
                          <span>{question.vocabulary.definition}</span>
                        </div>
                        {question.vocabulary.synonyms.length > 0 && (
                          <div>
                            <span className="font-medium text-muted-foreground">Synonyms:</span>{" "}
                            <span>{question.vocabulary.synonyms.join(", ")}</span>
                          </div>
                        )}
                        {question.vocabulary.antonyms.length > 0 && (
                          <div>
                            <span className="font-medium text-muted-foreground">Antonyms:</span>{" "}
                            <span>{question.vocabulary.antonyms.join(", ")}</span>
                          </div>
                        )}
                        {question.vocabulary.examples.length > 0 && (
                          <div>
                            <span className="font-medium text-muted-foreground">Examples:</span>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {question.vocabulary.examples.map((ex, i) => (
                                <li key={i} className="text-muted-foreground">{ex}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {question.rejection_reason && (
                    <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                      Rejection reason: {question.rejection_reason}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Question" : actionType === "reject" ? "Reject Question" : "Score Question"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {selectedQuestion?.question_text}
            </p>

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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Save Score"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};