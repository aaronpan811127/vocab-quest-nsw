import { useState, useEffect } from "react";
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
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVocabulary();
  }, [unitId]);

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
        // Fallback: fetch words from units table
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('words')
          .eq('id', unitId)
          .single();

        if (unitError) throw unitError;

        // Create basic vocabulary from unit words
        const basicWords: Word[] = (unitData.words as string[]).map((word, index) => ({
          id: `temp-${index}`,
          word,
          definition: "Definition not available yet",
          synonyms: [],
          antonyms: [],
          examples: []
        }));

        setWords(basicWords);
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
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(words[currentIndex].word);
      utterance.lang = 'en-US';
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
              Back to Dashboard
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
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Flashcards: {unitTitle}
            </h1>
            <p className="text-muted-foreground">
              Card {currentIndex + 1} of {words.length}
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
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
              relative w-full min-h-[400px] transition-transform duration-500 transform-style-3d
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
                absolute w-full h-full p-8 flex flex-col items-center justify-center
                bg-gradient-to-br from-card to-card/80 border-2 border-primary/20
                ${isFlipped ? 'opacity-0' : 'opacity-100'}
                transition-opacity duration-300
              `}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {learnedWords.has(currentWord.id) && (
                <Badge className="absolute top-4 right-4 bg-green-500/20 text-green-500 border-green-500/30">
                  <Check className="h-3 w-3 mr-1" />
                  Learned
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 left-4"
                onClick={(e) => {
                  e.stopPropagation();
                  speakWord();
                }}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
              <h2 className="text-5xl font-bold text-primary mb-4">
                {currentWord.word}
              </h2>
              <p className="text-muted-foreground">Tap to reveal definition</p>
            </Card>

            {/* Back of card (Definition, Synonyms, Antonyms, Examples) */}
            <Card 
              className={`
                absolute w-full min-h-[400px] p-6 
                bg-gradient-to-br from-primary/10 to-card border-2 border-primary/30
                ${isFlipped ? 'opacity-100' : 'opacity-0'}
                transition-opacity duration-300
              `}
              style={{ 
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <div className="space-y-4 h-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-primary">{currentWord.word}</h3>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord();
                    }}
                  >
                    <Volume2 className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Definition</h4>
                    <p className="text-lg">{currentWord.definition}</p>
                  </div>

                  {currentWord.synonyms.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Synonyms</h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {currentWord.synonyms.map((syn, i) => (
                          <Badge key={i} variant="secondary">{syn}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWord.antonyms.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Antonyms</h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {currentWord.antonyms.map((ant, i) => (
                          <Badge key={i} variant="outline">{ant}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentWord.examples.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Examples</h4>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        {currentWord.examples.map((ex, i) => (
                          <li key={i} className="text-muted-foreground italic">{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center pt-2">
                  Tap to flip back
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleShuffle}>
              <Shuffle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          {!learnedWords.has(currentWord.id) ? (
            <Button 
              variant="hero" 
              onClick={handleMarkLearned}
            >
              <Check className="h-5 w-5 mr-2" />
              Mark Learned
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={handleNext}
              disabled={currentIndex === words.length - 1}
            >
              Next
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
