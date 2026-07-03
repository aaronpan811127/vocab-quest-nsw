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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

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

    // Server-side premium/trial gate
    {
      const { data: unitRow, error: unitErr } = await supabaseUser
        .from("units").select("unit_number, test_type_id").eq("id", unit_id).single();
      if (unitErr || !unitRow) {
        return new Response(JSON.stringify({ error: "Invalid unit" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: premiumFlag } = await supabaseUser.rpc("has_premium_access", { _user_id: user.id });
      if (premiumFlag !== true) {
        const { count } = await supabaseUser.from("units")
          .select("id", { count: "exact", head: true })
          .eq("test_type_id", (unitRow as any).test_type_id)
          .lte("unit_number", (unitRow as any).unit_number);
        if ((count ?? 0) > 2) {
          return new Response(JSON.stringify({ error: "Premium subscription required for this unit" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
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

    // Check existing non-rejected questions for each word in this unit+game
    const { data: existingQuestions, error: fetchError } = await supabase
      .from("question_bank")
      .select("id, question_text, correct_answer, options, word, review_status")
      .eq("unit_id", unit_id)
      .eq("game_id", game_id)
      .neq("review_status", "rejected");

    if (fetchError) {
      console.error("Error fetching existing questions:", fetchError);
      throw new Error("Failed to check existing questions");
    }

    console.log(`Found ${existingQuestions?.length || 0} non-rejected questions for unit ${unit_id}, game ${game_id}`);

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
        questions: (existingQuestions || []).map(({ correct_answer, ...q }: any) => q), 
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
1. Create a sentence with a blank (______) where the vocabulary word from the list should go
2. The correct answer MUST BE the vocabulary word being tested - the blank is where that word fits
3. The sentence should test understanding of the vocabulary word in context
4. Include 4 answer options (the correct vocabulary word and three distractors)
5. Include 3 "trap" distractor options that:
   - Seem correct at first glance
   - Have similar but subtly different meanings
   - Would be wrong based on careful reading of the context
6. Make sure the vocabulary word is the only one that fits grammatically and semantically

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
- The "word" field is the vocabulary word being tested AND it MUST be the correct_answer
- The blank in the sentence is where the vocabulary word fits
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
      // Clean the response - remove markdown formatting and sanitize
      let jsonStr = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      // Remove any control characters and problematic unicode
      jsonStr = jsonStr
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u2000-\u206F\u2018-\u201F]/g, '');
      
      try {
        questionsData = JSON.parse(jsonStr);
      } catch (firstParseError) {
        console.log("First parse attempt failed, trying aggressive cleanup...");
        jsonStr = jsonStr
          .replace(/[^\x20-\x7E\n\r\t]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        questionsData = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content.substring(0, 500));
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
    // Strip correct_answer before returning to client — server-side grading only
    const safeQuestions = allQuestions.map(({ correct_answer, ...q }: any) => q);

    return new Response(JSON.stringify({ 
      success: true, 
      questions: safeQuestions,
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
