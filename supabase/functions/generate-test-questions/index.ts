import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { unit_id, words, game_type, game_id, test_type_code } = await req.json();

    if (!unit_id || !words || !Array.isArray(words) || words.length === 0) {
      return new Response(JSON.stringify({ error: "unit_id and words array are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!game_type || !game_id) {
      return new Response(JSON.stringify({ error: "game_type and game_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["context_master", "cloze_challenge"].includes(game_type)) {
      return new Response(JSON.stringify({ error: "Invalid game type for test questions" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get game rules for questions_per_word
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("rules")
      .eq("id", game_id)
      .single();

    if (gameError) {
      console.error("Error fetching game rules:", gameError);
      throw new Error("Failed to fetch game configuration");
    }

    const questionsPerWord = gameData?.rules?.questions_per_word || 3;
    console.log(`Questions per word from rules: ${questionsPerWord}`);

    // Check existing questions for each word in this unit+game
    const { data: existingQuestions, error: fetchError } = await supabase
      .from("question_bank")
      .select("id, question_text, correct_answer, options, word")
      .eq("unit_id", unit_id)
      .eq("game_id", game_id);

    if (fetchError) {
      console.error("Error fetching existing questions:", fetchError);
      throw new Error("Failed to check existing questions");
    }

    // Count questions per word
    const questionsCountByWord: Record<string, number> = {};
    existingQuestions?.forEach((q) => {
      const word = q.word?.toLowerCase();
      if (word) {
        questionsCountByWord[word] = (questionsCountByWord[word] || 0) + 1;
      }
    });

    // Filter words that need more questions
    const wordsNeedingQuestions: string[] = [];
    const wordsToGenerateCounts: Record<string, number> = {};

    words.forEach((word: string) => {
      const lowerWord = word.toLowerCase();
      const currentCount = questionsCountByWord[lowerWord] || 0;
      const needed = questionsPerWord - currentCount;
      if (needed > 0) {
        wordsNeedingQuestions.push(word);
        wordsToGenerateCounts[lowerWord] = needed;
      }
    });

    console.log("Words needing questions:", wordsNeedingQuestions);
    console.log("Questions needed per word:", wordsToGenerateCounts);

    // If no words need questions, return existing ones
    if (wordsNeedingQuestions.length === 0) {
      console.log("All words have sufficient questions, returning existing");
      return new Response(JSON.stringify({ 
        success: true, 
        questions: existingQuestions, 
        generated: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine age group based on test type
    let gradeLevel = "grades 5-12";
    if (test_type_code) {
      if (test_type_code.includes("Y3")) {
        gradeLevel = "Year 3 students (ages 8-9)";
      } else if (test_type_code.includes("Y5")) {
        gradeLevel = "Year 5 students (ages 10-11)";
      } else if (test_type_code === "OC") {
        gradeLevel = "students preparing for Opportunity Class placement (grades 4-5)";
      } else if (test_type_code === "SELECTIVE") {
        gradeLevel = "students preparing for Selective High School entrance (grade 6)";
      }
    }

    let prompt: string;
    let questionsData: any[];

    if (game_type === "context_master") {
      // Build generation request with specific counts per word
      const wordRequests = wordsNeedingQuestions.map(w => 
        `${w} (generate ${wordsToGenerateCounts[w.toLowerCase()]} questions)`
      ).join(", ");

      prompt = `Generate context-based vocabulary quiz questions for ${gradeLevel}.

Words to create questions for: ${wordRequests}

For each question:
1. Create a multiple choice question that tests understanding of the word's meaning in context
2. The question should use context clues effectively - students should be able to infer the answer
3. Include 4 answer options (A, B, C, D)
4. Include 3 "trap" distractor options that:
   - Seem correct at first glance
   - Have similar but subtly different meanings
   - Would be wrong based on careful reading of the context
5. Make sure the correct answer is clearly the best choice when context is considered carefully
6. Questions should be logical and internally consistent

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "word": "reluctant",
    "question_text": "In the sentence 'Despite the sunny weather, Sarah was reluctant to go outside,' what does 'reluctant' most likely mean?",
    "options": ["eager and excited", "unwilling or hesitant", "confused and lost", "tired and sleepy"],
    "correct_answer": "unwilling or hesitant",
    "explanation": "The word 'despite' suggests contrast with the sunny weather, indicating Sarah's unwillingness."
  }
]

IMPORTANT:
- Make sure each question tests ONE specific word from the list
- Questions should be age-appropriate for ${gradeLevel}
- Distractors should be plausible but clearly wrong with careful reading
- No markdown formatting - plain text only`;
    } else {
      // cloze_challenge
      const wordRequests = wordsNeedingQuestions.map(w => 
        `${w} (generate ${wordsToGenerateCounts[w.toLowerCase()]} questions)`
      ).join(", ");

      prompt = `Generate cloze (fill-in-the-blank) vocabulary quiz questions for ${gradeLevel}.

Words to create questions for: ${wordRequests}

For each question:
1. Create a sentence with a blank (______) where a word should go
2. The blank does NOT need to be filled with the word from the list - it can be any appropriate word
3. The sentence should test understanding of vocabulary in context
4. Include 4 answer options (one correct, three distractors)
5. Include 3 "trap" distractor options that:
   - Seem correct at first glance
   - Have similar but subtly different meanings
   - Would be wrong based on careful reading of the context
6. Make sure the correct answer is the only one that fits grammatically and semantically

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "word": "persistent",
    "question_text": "The scientist was ______ in her research, spending years trying to find a cure.",
    "options": ["lazy", "persistent", "forgetful", "careless"],
    "correct_answer": "persistent",
    "explanation": "The context of spending years on research indicates determination and persistence."
  },
  {
    "word": "abundant",
    "question_text": "After the heavy rains, the garden had an ______ supply of water.",
    "options": ["scarce", "abundant", "limited", "empty"],
    "correct_answer": "abundant",
    "explanation": "Heavy rains would lead to a plentiful (abundant) supply of water."
  }
]

IMPORTANT:
- The "word" field indicates which vocabulary word this question is testing, but the answer may be different
- Questions should be age-appropriate for ${gradeLevel}
- Distractors should be plausible but clearly wrong with careful reading
- No markdown formatting - plain text only`;
    }

    console.log(`Generating ${game_type} questions for words:`, wordsNeedingQuestions);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert educational content creator specializing in vocabulary assessments. Create challenging but fair questions that test genuine understanding. Return only valid JSON with no markdown formatting or code blocks.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate test questions");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    try {
      const cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      questionsData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse questions data");
    }

    // Prepare records for insertion
    const questionRecords = questionsData.map((item: any) => ({
      unit_id,
      game_id,
      word: item.word.toLowerCase(),
      question_text: item.question_text,
      correct_answer: item.correct_answer,
      options: JSON.stringify(item.options),
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("question_bank")
      .insert(questionRecords)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save questions data");
    }

    console.log("Successfully generated and saved", insertedData?.length, "test questions");

    // Combine existing and new questions for response
    const allQuestions = [...(existingQuestions || []), ...(insertedData || [])];

    return new Response(JSON.stringify({ 
      success: true, 
      questions: allQuestions,
      generated: insertedData?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-test-questions:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
