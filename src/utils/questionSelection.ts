/**
 * Utility functions for balanced question selection in word-based games.
 * Ensures every unit word is tested at least once per game attempt,
 * then fills remaining slots randomly.
 */

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Selects questions ensuring each word is tested at least once.
 * 
 * Algorithm:
 * 1. Group questions by word (case-insensitive)
 * 2. Select one question per word (shuffled selection)
 * 3. If limit > word count, fill remaining slots from unused questions
 * 4. Shuffle final selection for random order
 * 
 * @param questions - All available questions with id and word fields
 * @param limit - Maximum number of questions to return
 * @param getWord - Function to extract the word from a question (default: q => q.word)
 * @returns Selected questions ensuring word coverage
 */
export function selectBalancedQuestions<T extends { id: string; word: string }>(
  questions: T[],
  limit: number
): T[] {
  if (questions.length === 0) return [];
  if (questions.length <= limit) return shuffleArray(questions);

  // Group questions by word (case-insensitive)
  const questionsByWord = new Map<string, T[]>();
  
  for (const question of questions) {
    const wordKey = question.word?.toLowerCase() || 'unknown';
    const existing = questionsByWord.get(wordKey) || [];
    existing.push(question);
    questionsByWord.set(wordKey, existing);
  }

  const selectedQuestions: T[] = [];
  const usedQuestionIds = new Set<string>();
  const words = Array.from(questionsByWord.keys());
  
  // Phase 1: Select one question per word (ensuring each word is tested)
  const shuffledWords = shuffleArray(words);
  
  for (const word of shuffledWords) {
    if (selectedQuestions.length >= limit) break;
    
    const wordQuestions = questionsByWord.get(word) || [];
    const shuffledWordQuestions = shuffleArray(wordQuestions);
    
    // Pick first unused question for this word
    const selected = shuffledWordQuestions.find(q => !usedQuestionIds.has(q.id));
    if (selected) {
      selectedQuestions.push(selected);
      usedQuestionIds.add(selected.id);
    }
  }

  // Phase 2: Fill remaining slots with random unused questions
  if (selectedQuestions.length < limit) {
    const remainingQuestions = questions.filter(q => !usedQuestionIds.has(q.id));
    const shuffledRemaining = shuffleArray(remainingQuestions);
    
    for (const question of shuffledRemaining) {
      if (selectedQuestions.length >= limit) break;
      selectedQuestions.push(question);
      usedQuestionIds.add(question.id);
    }
  }

  // Shuffle final selection for random question order
  return shuffleArray(selectedQuestions);
}

/**
 * Gets unique words from a list of questions
 */
export function getUniqueWords<T extends { word: string }>(questions: T[]): string[] {
  const words = new Set<string>();
  for (const q of questions) {
    if (q.word) {
      words.add(q.word.toLowerCase());
    }
  }
  return Array.from(words);
}
