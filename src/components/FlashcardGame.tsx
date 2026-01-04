import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Shuffle,
  BookOpen,
  Volume2,
  Check,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Word {
  id: string;
  word: string;
  definition: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
}

interface FlashcardGameProps {
  unitId: string;
  unitTitle: string;
  onComplete: () => void;
  onBack: () => void;
}

export const FlashcardGame = ({ unitId, unitTitle, onComplete, onBack }: FlashcardGameProps) => {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const femaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const { toast } = useToast();

  // Save progress to database when all words are learned
  const saveProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Check if progress exists
    const { data: existingProgress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('unit_id', unitId)
      .eq('game_type', 'flashcards')
      .maybeSingle();

    if (existingProgress) {
      await supabase
        .from('user_progress')
        .update({
          completed: true,
          attempts: (existingProgress.attempts || 0) + 1,
          total_time_seconds: (existingProgress.total_time_seconds || 0) + timeSpentSeconds,
          best_score: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id);
    } else {
      await supabase
        .from('user_progress')
        .insert({
          user_id: user.id,
          unit_id: unitId,
          game_type: 'flashcards',
          completed: true,
          attempts: 1,
          total_time_seconds: timeSpentSeconds,
          best_score: 100
        });
    }
  };

  // Auto-save when all words are learned
  useEffect(() => {
    if (words.length > 0 && learnedWords.size === words.length) {
      saveProgress();
    }
  }, [learnedWords.size, words.length]);

  useEffect(() => {
    // Find a female voice
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.toLowerCase().includes('female') ||
         voice.name.toLowerCase().includes('samantha') ||
         voice.name.toLowerCase().includes('victoria') ||
         voice.name.toLowerCase().includes('karen') ||
         voice.name.toLowerCase().includes('moira') ||
         voice.name.toLowerCase().includes('tessa') ||
         voice.name.toLowerCase().includes('fiona') ||
         voice.name.includes('Google US English') ||
         voice.name.includes('Microsoft Zira'))
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      femaleVoiceRef.current = femaleVoice || null;
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

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
        toast({
          title: "Vocabulary Generated",
          description: `Created flashcards for ${data.vocabulary.length} words.`,
        });
      } else {
        throw new Error(data.error || "Failed to generate vocabulary");
      }
    } catch (err: any) {
      console.error('Error generating vocabulary:', err);
      
      if (err.message?.includes('429') || err.message?.includes('Rate limit')) {
        toast({
          title: "Rate limit exceeded",
          description: "Please wait a moment before trying again.",
          variant: "destructive",
        });
      } else if (err.message?.includes('402')) {
        toast({
          title: "AI credits needed",
          description: "Please add credits to continue generating content.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation failed",
          description: "Could not generate vocabulary. Using basic words.",
          variant: "destructive",
        });
      }
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
        // Fetch words from units table and generate vocabulary
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('words')
          .eq('id', unitId)
          .single();

        if (unitError) throw unitError;

        const unitWords = unitData.words as string[];
        
        // Create temporary basic words while generating
        const basicWords: Word[] = unitWords.map((word, index) => ({
          id: `temp-${index}`,
          word,
          definition: "Generating definition...",
          synonyms: [],
          antonyms: [],
          examples: []
        }));
        setWords(basicWords);
        setLoading(false);
        
        // Generate vocabulary in background
        await generateVocabulary(unitWords);
      } else {
        setWords(data as Word[]);
      }
    } catch (err) {
      console.error('Error fetching vocabulary:', err);
      setError("Failed to load vocabulary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleMarkLearned = () => {
    const newLearned = new Set(learnedWords);
    newLearned.add(words[currentIndex].id);
    setLearnedWords(newLearned);
    handleNext();
  };

  const handleShuffle = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setLearnedWords(new Set());
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const speakWord = () => {
    if ('speechSynthesis' in window && words[currentIndex]) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(words[currentIndex].word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      if (femaleVoiceRef.current) {
        utterance.voice = femaleVoiceRef.current;
      }
      speechSynthesis.speak(utterance);
    }
  };

  const progress = words.length > 0 ? ((learnedWords.size / words.length) * 100) : 0;
  const currentWord = words[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Loading flashcards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">Generating vocabulary...</p>
            <p className="text-muted-foreground">Creating definitions, synonyms, and examples</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || words.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold">{error || "No vocabulary available"}</h2>
            <p className="text-muted-foreground">
              Please check back later or try a different unit.
            </p>
            <Button variant="outline" onClick={onBack} size="lg">
              Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Completion screen
  if (learnedWords.size === words.length) {
    return (
      <div className="min-h-screen bg-gradient-hero p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-6 bg-card/50 backdrop-blur-sm border-2 border-border/50">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-primary">All Words Learned!</h2>
            <p className="text-lg text-muted-foreground">
              You've reviewed all {words.length} words in {unitTitle}!
            </p>
            <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-lg px-6 py-2">
              {words.length} / {words.length} Complete
            </Badge>
            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={handleReset} size="lg">
                <RotateCcw className="h-5 w-5 mr-2" />
                Review Again
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

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="truncate">{unitTitle}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Card {currentIndex + 1} of {words.length}
            </p>
          </div>
          <Button variant="outline" onClick={onBack} size="sm">
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span>Learned: {learnedWords.size} / {words.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Flashcard */}
        <div 
          className="perspective-1000 cursor-pointer"
          onClick={handleFlip}
        >
          <div 
            className={`
              relative w-full min-h-[300px] sm:min-h-[400px] transition-transform duration-500 transform-style-3d
              ${isFlipped ? 'rotate-y-180' : ''}
            `}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front of card (Word) */}
            <Card 
              className={`
                absolute w-full h-full p-4 sm:p-8 flex flex-col items-center justify-center
                bg-gradient-to-br from-card to-card/80 border-2 border-primary/20
                ${isFlipped ? 'opacity-0' : 'opacity-100'}
                transition-opacity duration-300
              `}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {learnedWords.has(currentWord.id) && (
                <Badge className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Learned
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 left-3 sm:top-4 sm:left-4 h-8 w-8 sm:h-9 sm:w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  speakWord();
                }}
              >
                <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <h2 className="text-3xl sm:text-5xl font-bold text-primary mb-3 sm:mb-4 text-center px-8">
                {currentWord.word}
              </h2>
              <p className="text-sm text-muted-foreground">Tap to reveal definition</p>
            </Card>

            {/* Back of card (Definition, Synonyms, Antonyms, Examples) */}
            <Card 
              className={`
                absolute w-full min-h-[300px] sm:min-h-[400px] p-4 sm:p-6 overflow-y-auto
                bg-gradient-to-br from-primary/10 to-card border-2 border-primary/30
                ${isFlipped ? 'opacity-100' : 'opacity-0'}
                transition-opacity duration-300
              `}
              style={{ 
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <div className="space-y-3 sm:space-y-4 h-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl sm:text-2xl font-bold text-primary">{currentWord.word}</h3>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord();
                    }}
                  >
                    <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Definition</h4>
                    <p className="text-sm sm:text-lg">{currentWord.definition}</p>
                  </div>

                  {currentWord.synonyms.length > 0 && (
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Synonyms</h4>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                        {currentWord.synonyms.map((syn, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{syn}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWord.antonyms.length > 0 && (
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Antonyms</h4>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                        {currentWord.antonyms.map((ant, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{ant}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWord.examples.length > 0 && (
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Examples</h4>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        {currentWord.examples.slice(0, 2).map((ex, i) => (
                          <li key={i} className="text-xs sm:text-sm text-muted-foreground italic">{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center pt-1">
                  Tap to flip back
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            size="sm"
            className="px-2 sm:px-4"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={handleShuffle} className="h-8 w-8 sm:h-9 sm:w-9">
              <Shuffle className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8 sm:h-9 sm:w-9">
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          {!learnedWords.has(currentWord.id) ? (
            <Button 
              variant="hero" 
              onClick={handleMarkLearned}
              size="sm"
              className="px-2 sm:px-4"
            >
              <Check className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Mark Learned</span>
              <span className="sm:hidden">Done</span>
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={handleNext}
              disabled={currentIndex === words.length - 1}
              size="sm"
              className="px-2 sm:px-4"
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="h-4 w-4 sm:ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
