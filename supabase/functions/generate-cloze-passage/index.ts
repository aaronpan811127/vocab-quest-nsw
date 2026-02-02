import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLOZE_PASSAGE_GAME_ID = 'c79abfa0-22d0-42db-89a9-e496f190172a'; // Will be updated after checking DB

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

    const { unit_id, unit_title, words, test_type_code } = await req.json();

    if (!unit_id || !words || !Array.isArray(words) || words.length === 0) {
      return new Response(JSON.stringify({ error: "unit_id and words array are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the game ID for linked_extracts
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("id, rules")
      .eq("game_type", "linked_extracts")
      .single();

    if (gameError || !gameData) {
      console.error("Error fetching game:", gameError);
      return new Response(JSON.stringify({ error: "Cloze Passage game not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gameId = gameData.id;
    const rules = gameData.rules as any || {};
    const numExtracts = rules.num_extracts || 4;
    const numQuestions = rules.questions_per_passage || rules.num_questions || 10;
    const passagesPerGame = rules.passages_per_game || 3;

    // A "valid" Linked Extracts passage must have >= numQuestions non-rejected questions.
    // Previously we only counted passages, which can get stuck if all questions are rejected.
    const { data: existingPassages, error: passagesError } = await supabase
      .from("reading_passages")
      .select("id, review_status")
      .eq("unit_id", unit_id)
      .ilike("title", "Linked Extracts:%")
      .or("review_status.is.null,review_status.neq.rejected");

    if (passagesError) {
      console.error("Error fetching existing passages:", passagesError);
      throw new Error("Failed to check existing passages");
    }

    const passageIds = (existingPassages || []).map((p: any) => p.id as string);
    let validPassageCount = 0;

    if (passageIds.length > 0) {
      const { data: allQuestionsForPassages, error: questionsError } = await supabase
        .from("question_bank")
        .select("id, passage_id, review_status")
        .eq("unit_id", unit_id)
        .eq("game_id", gameId)
        .in("passage_id", passageIds);

      if (questionsError) {
        console.error("Error fetching existing questions:", questionsError);
        throw new Error("Failed to check existing questions");
      }

      const totalByPassage = new Map<string, number>();
      const nonRejectedByPassage = new Map<string, number>();

      for (const q of allQuestionsForPassages || []) {
        const pid = (q as any).passage_id as string | null;
        if (!pid) continue;
        totalByPassage.set(pid, (totalByPassage.get(pid) || 0) + 1);
        const status = (q as any).review_status as string | null;
        if (status !== "rejected") {
          nonRejectedByPassage.set(pid, (nonRejectedByPassage.get(pid) || 0) + 1);
        }
      }

      // Count valid passages
      const invalidButGeneratedPassageIds: string[] = [];
      for (const pid of passageIds) {
        const nonRejected = nonRejectedByPassage.get(pid) || 0;
        if (nonRejected >= numQuestions) {
          validPassageCount += 1;
        } else {
          const total = totalByPassage.get(pid) || 0;
          // If we have a full set of questions but ALL were rejected, mark the passage rejected too
          // to keep the pool consistent and allow regeneration.
          if (total >= numQuestions && nonRejected === 0) {
            invalidButGeneratedPassageIds.push(pid);
          }
        }
      }

      if (invalidButGeneratedPassageIds.length > 0) {
        console.log(
          `Marking ${invalidButGeneratedPassageIds.length} Linked Extracts passages as rejected because all questions were rejected.`
        );
        const { error: rejectPassagesError } = await supabase
          .from("reading_passages")
          .update({
            review_status: "rejected",
            rejection_reason: "All Linked Extracts questions rejected; regenerating",
          })
          .in("id", invalidButGeneratedPassageIds);

        if (rejectPassagesError) {
          console.error("Error marking passages rejected:", rejectPassagesError);
          // Non-fatal: generation can still proceed using validPassageCount
        } else {
          // Those passages are no longer non-rejected, so they shouldn't contribute to the valid pool.
          // (validPassageCount is unaffected because we only incremented it for valid passages.)
        }
      }
    }

    console.log(`Unit ${unit_id}: ${validPassageCount}/${passagesPerGame} valid Linked Extracts passages exist`);

    // If we already have enough valid passages, return without generating
    if (validPassageCount >= passagesPerGame) {
      console.log("Sufficient valid Linked Extracts passages exist, skipping generation");
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: `Already have ${validPassageCount} valid Linked Extracts passages (minimum: ${passagesPerGame})`,
          existing_count: validPassageCount,
          required_count: passagesPerGame,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Generating Linked Extracts passage ${validPassageCount + 1}/${passagesPerGame} for unit: ${unit_id}, words: ${words.length}, questions: ${numQuestions}`
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine difficulty level based on test type
    let gradeLevel = "Year 6-7 selective school entrance level";
    if (test_type_code) {
      if (test_type_code.includes("Y3")) {
        gradeLevel = "Year 3 students (ages 8-9)";
      } else if (test_type_code.includes("Y5")) {
        gradeLevel = "Year 5 students (ages 10-11)";
      } else if (test_type_code === "OC") {
        gradeLevel = "Opportunity Class level (grades 4-5, advanced)";
      } else if (test_type_code === "SELECTIVE") {
        gradeLevel = "Selective High School entrance level (Year 6-7, highly advanced)";
      }
    }

    // Select words to incorporate - take a subset to weave into the extracts
    const selectedWords = words.slice(0, Math.min(15, words.length));

    const prompt = `Create a comprehensive reading comprehension exercise for ${gradeLevel} on the theme of "${unit_title}".

You must create exactly ${numExtracts} different extracts (labeled A, B, C, D) that explore different aspects of the theme. Each extract should be a different TEXT TYPE:

Extract A: A literary narrative or personal reflection (first-person perspective, descriptive language, metaphors)
Extract B: A formal/official document (notice, regulation, policy, or procedural text)
Extract C: A literary fiction excerpt (third-person narrative, imagery, symbolism, figurative language)
Extract D: An informational/expository text (factual, educational, explaining concepts)

Each extract should be 100-150 words and written in a style appropriate to its text type.

Try to naturally incorporate some of these vocabulary words into the extracts where they fit naturally: ${selectedWords.join(', ')}

Then create exactly ${numQuestions} analytical questions that ask "Which extract..." with options A, B, C, or D.

Questions should test:
- Identifying text purposes and styles
- Recognizing literary devices (personification, metaphor, symbolism)
- Comparing/contrasting perspectives across extracts
- Understanding tone, mood, and author's intent
- Identifying evidence and inference skills

Return ONLY a valid JSON object with this exact structure:
{
  "extracts": [
    {
      "label": "A",
      "title": "Brief title for Extract A",
      "content": "Full text of extract A (100-150 words)",
      "text_type": "literary narrative"
    },
    {
      "label": "B",
      "title": "Brief title for Extract B",
      "content": "Full text of extract B (100-150 words)",
      "text_type": "formal document"
    },
    {
      "label": "C",
      "title": "Brief title for Extract C", 
      "content": "Full text of extract C (100-150 words)",
      "text_type": "literary fiction"
    },
    {
      "label": "D",
      "title": "Brief title for Extract D",
      "content": "Full text of extract D (100-150 words)",
      "text_type": "informational"
    }
  ],
  "questions": [
    {
      "question_text": "Which extract presents [theme/style] as a [description]?",
      "correct_answer": "A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

IMPORTANT:
- Each question must have a single correct answer (A, B, C, or D)
- Questions should require careful analysis, not just surface reading
- Make extracts distinct enough that answers are clear upon careful reading
- Ensure variety in question types (style, purpose, device, tone, comparison)
- All text should be age-appropriate for ${gradeLevel}
- No markdown formatting - plain text only`;

    console.log("Generating cloze passage content with AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 8192,
        messages: [
          {
            role: "system",
            content: "You are an expert educational content creator specializing in reading comprehension and literary analysis for selective school entrance exams. Create challenging but fair questions that test genuine analytical thinking. Return only valid JSON with no markdown formatting or code blocks. Keep responses concise but complete.",
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
      throw new Error("Failed to generate cloze passage content");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsedContent;
    try {
      // Clean the response - remove markdown formatting and sanitize
      let jsonStr = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      // Check for truncation - JSON must end with } and have balanced braces
      const trimmed = jsonStr.trim();
      if (!trimmed.endsWith('}')) {
        console.error("AI response appears truncated, last 200 chars:", trimmed.slice(-200));
        throw new Error("AI response was truncated - please retry");
      }
      
      // Check for balanced braces as additional truncation detection
      const openBraces = (jsonStr.match(/{/g) || []).length;
      const closeBraces = (jsonStr.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        console.error(`Unbalanced braces: ${openBraces} open vs ${closeBraces} close`);
        throw new Error("AI response was truncated (unbalanced JSON) - please retry");
      }
      
      // Remove any control characters and problematic unicode that might have slipped in
      jsonStr = jsonStr
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u2000-\u206F\u2018-\u201F]/g, ''); // Remove non-standard chars
      
      try {
        parsedContent = JSON.parse(jsonStr);
      } catch (firstParseError) {
        console.log("First parse attempt failed, trying aggressive cleanup...");
        // More aggressive cleanup - remove anything that's not standard ASCII or common punctuation
        jsonStr = jsonStr
          .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        parsedContent = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      throw new Error("Failed to parse generated content - please retry");
    }

    // Validate the response structure
    if (!parsedContent.extracts || !Array.isArray(parsedContent.extracts) || parsedContent.extracts.length !== numExtracts) {
      throw new Error(`Expected ${numExtracts} extracts but got ${parsedContent.extracts?.length || 0}`);
    }

    if (!parsedContent.questions || !Array.isArray(parsedContent.questions) || parsedContent.questions.length < numQuestions) {
      throw new Error(`Expected at least ${numQuestions} questions but got ${parsedContent.questions?.length || 0}`);
    }

    // Store the passage as a reading passage for reference
    const { data: passageData, error: passageError } = await supabase
      .from("reading_passages")
      .insert({
        unit_id,
        title: `Linked Extracts: ${unit_title}`,
        content: JSON.stringify(parsedContent.extracts),
        is_generated: true,
        generated_by: user.id,
        highlighted_words: selectedWords
      })
      .select()
      .single();

    if (passageError) {
      console.error("Error saving passage:", passageError);
      throw new Error("Failed to save passage");
    }

    // Store questions in question_bank
    const questionRecords = parsedContent.questions.slice(0, numQuestions).map((q: any, index: number) => ({
      unit_id,
      game_id: gameId,
      passage_id: passageData.id,
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      options: JSON.stringify(["A", "B", "C", "D"]),
      word: `question_${index + 1}` // Track question order
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("question_bank")
      .insert(questionRecords)
      .select();

    if (insertError) {
      console.error("Error saving questions:", insertError);
      throw new Error("Failed to save questions");
    }

    console.log(`Successfully generated cloze passage with ${parsedContent.extracts.length} extracts and ${insertedQuestions?.length} questions`);

    return new Response(JSON.stringify({
      success: true,
      passage_id: passageData.id,
      extracts: parsedContent.extracts,
      questions: insertedQuestions?.map((q: any, index: number) => ({
        id: q.id,
        question_text: q.question_text,
        options: ["A", "B", "C", "D"],
        explanation: parsedContent.questions[index]?.explanation
      }))
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-cloze-passage:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
