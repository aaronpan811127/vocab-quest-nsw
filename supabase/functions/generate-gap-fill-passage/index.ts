import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { unit_id, unit_title, words, test_type_code } = await req.json();

    if (!unit_id || !words || !Array.isArray(words) || words.length === 0) {
      return new Response(JSON.stringify({ error: "unit_id and words array are required" }), {
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

    // Get the game ID for gap_fill_passage
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("id, rules")
      .eq("game_type", "gap_fill_passage")
      .single();

    if (gameError || !gameData) {
      console.error("Error fetching game:", gameError);
      return new Response(JSON.stringify({ error: "Gap Fill Passage game not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gameId = gameData.id;
    const rules = gameData.rules as any || {};
    const numGaps = rules.questions_per_passage || 8;
    const numOptions = rules.options_count || 9; // 8 correct + 1 distractor
    const passagesPerGame = rules.passages_per_game || 3;

    // Check for existing valid passages
    const { data: existingPassages, error: passagesError } = await supabase
      .from("reading_passages")
      .select("id, review_status")
      .eq("unit_id", unit_id)
      .ilike("title", "Gap Fill Passage:%")
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

      // Count valid passages (those with enough non-rejected questions)
      const invalidPassageIds: string[] = [];
      for (const pid of passageIds) {
        const nonRejected = nonRejectedByPassage.get(pid) || 0;
        if (nonRejected >= numGaps) {
          validPassageCount += 1;
        } else {
          const total = totalByPassage.get(pid) || 0;
          if (total >= numGaps && nonRejected === 0) {
            invalidPassageIds.push(pid);
          }
        }
      }

      if (invalidPassageIds.length > 0) {
        console.log(`Marking ${invalidPassageIds.length} Gap Fill passages as rejected`);
        await supabase
          .from("reading_passages")
          .update({
            review_status: "rejected",
            rejection_reason: "All Gap Fill questions rejected; regenerating",
          })
          .in("id", invalidPassageIds);
      }
    }

    console.log(`Unit ${unit_id}: ${validPassageCount}/${passagesPerGame} valid Gap Fill passages exist`);

    // If we have enough valid passages, skip generation
    if (validPassageCount >= passagesPerGame) {
      console.log("Sufficient valid Gap Fill passages exist, skipping generation");
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: `Already have ${validPassageCount} valid Gap Fill passages (minimum: ${passagesPerGame})`,
          existing_count: validPassageCount,
          required_count: passagesPerGame,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Generating Gap Fill passage ${validPassageCount + 1}/${passagesPerGame} for unit: ${unit_id}, words: ${words.length}, gaps: ${numGaps}`
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Select vocabulary words to incorporate
    const selectedWords = words.slice(0, Math.min(20, words.length));

    const prompt = `Create a challenging Gap Fill Passage exercise for NSW Selective High School entrance test level (Year 6-7 students, highly advanced).

You must create ONE long, coherent passage (450-550 words) on a theme related to "${unit_title}". The passage should be engaging, sophisticated, and appropriate for academically advanced Year 6-7 students.

The passage MUST contain exactly ${numGaps} gaps, marked as [Gap 1], [Gap 2], ... [Gap ${numGaps}].

Each gap should be filled with a SENTENCE OR PHRASE (not single words). The sentences/phrases should:
- Be 15-30 words each
- Fit naturally and logically into the passage
- Require comprehension of context, tone, and flow to identify correctly
- Test transitional thinking, cause-effect reasoning, or narrative cohesion

Try to naturally incorporate some of these vocabulary words into the passage or sentence options: ${selectedWords.join(', ')}

Then provide exactly ${numOptions} sentence/phrase options (labeled A through ${String.fromCharCode(64 + numOptions)}):
- ${numGaps} of these are the CORRECT answers for the gaps
- ${numOptions - numGaps} is a DISTRACTOR that sounds plausible but doesn't fit any gap

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Brief engaging title for the passage",
  "passage": "The full passage text with [Gap 1], [Gap 2], etc. markers",
  "options": [
    {
      "label": "A",
      "text": "The sentence or phrase that fits one of the gaps (15-30 words)"
    },
    {
      "label": "B", 
      "text": "Another sentence or phrase..."
    }
  ],
  "answers": {
    "1": "A",
    "2": "C",
    "3": "B"
  }
}

IMPORTANT:
- The "answers" object maps gap numbers (as strings) to the correct option labels
- Options should be shuffled so correct answers aren't in order
- Include exactly one distractor option that doesn't fit any gap
- All sentences should have similar length and style to prevent easy elimination
- Make distractors tempting but ultimately incorrect when reading carefully
- The passage should flow naturally even with gaps
- Use sophisticated vocabulary and complex sentence structures appropriate for selective test prep
- No markdown formatting - plain text only`;

    console.log("Generating Gap Fill passage content with AI...");

    // Retry logic for AI generation
    const MAX_RETRIES = 3;
    let parsedContent = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`AI generation attempt ${attempt}/${MAX_RETRIES}`);
        
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
                content: "You are an expert educational content creator specializing in NSW Selective High School entrance exam preparation. Create challenging but fair gap-fill exercises that test reading comprehension, logical thinking, and contextual understanding. Return only valid JSON with no markdown formatting or code blocks.",
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
          throw new Error("Failed to generate Gap Fill passage content");
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error("No content in AI response");
        }

        let jsonStr = content
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        // Check for truncation
        if (!jsonStr.trim().endsWith('}')) {
          console.error("AI response appears truncated");
          throw new Error("AI response was truncated - retrying");
        }

        const openBraces = (jsonStr.match(/{/g) || []).length;
        const closeBraces = (jsonStr.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
          throw new Error("AI response was truncated (unbalanced JSON) - retrying");
        }

        // Clean control characters
        jsonStr = jsonStr
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/[^\x20-\x7E\n\r\t\u00A0-\u00FF\u2000-\u206F\u2018-\u201F]/g, '');

        let tempContent;
        try {
          tempContent = JSON.parse(jsonStr);
        } catch {
          console.log("First parse attempt failed, trying aggressive cleanup...");
          jsonStr = jsonStr
            .replace(/[^\x20-\x7E\n\r\t]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          tempContent = JSON.parse(jsonStr);
        }

        // Validate response structure
        if (!tempContent.passage || typeof tempContent.passage !== 'string') {
          throw new Error("Invalid passage content");
        }

        if (!tempContent.options || !Array.isArray(tempContent.options) || tempContent.options.length !== numOptions) {
          throw new Error(`Expected ${numOptions} options but got ${tempContent.options?.length || 0}`);
        }

        if (!tempContent.answers || typeof tempContent.answers !== 'object') {
          throw new Error("Missing answers mapping");
        }

        // Verify we have answers for all gaps
        for (let i = 1; i <= numGaps; i++) {
          if (!tempContent.answers[String(i)]) {
            throw new Error(`Missing answer for Gap ${i}`);
          }
        }

        // All validations passed
        parsedContent = tempContent;
        break; // Success, exit retry loop
        
      } catch (parseError) {
        lastError = parseError;
        console.error(`Attempt ${attempt} failed:`, parseError instanceof Error ? parseError.message : parseError);
        
        if (attempt < MAX_RETRIES) {
          console.log(`Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!parsedContent) {
      console.error("All retry attempts failed");
      throw lastError || new Error("Failed to generate valid content after multiple attempts");
    }

    // Store the passage
    const { data: passageData, error: passageError } = await supabase
      .from("reading_passages")
      .insert({
        unit_id,
        title: `Gap Fill Passage: ${parsedContent.title || unit_title}`,
        content: JSON.stringify({
          passage: parsedContent.passage,
          options: parsedContent.options,
          answers: parsedContent.answers
        }),
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

    // Store questions in question_bank (one per gap)
    const questionRecords = [];
    for (let i = 1; i <= numGaps; i++) {
      const correctLabel = parsedContent.answers[String(i)];
      const correctOption = parsedContent.options.find((o: any) => o.label === correctLabel);
      
      questionRecords.push({
        unit_id,
        game_id: gameId,
        passage_id: passageData.id,
        question_text: `Gap ${i}`,
        correct_answer: correctLabel,
        options: parsedContent.options.map((o: any) => o.label),
        word: `gap_${i}`
      });
    }

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("question_bank")
      .insert(questionRecords)
      .select();

    if (insertError) {
      console.error("Error saving questions:", insertError);
      throw new Error("Failed to save questions");
    }

    console.log(`Successfully generated Gap Fill passage with ${numGaps} gaps and ${numOptions} options`);

    return new Response(JSON.stringify({
      success: true,
      passage_id: passageData.id,
      title: parsedContent.title,
      passage: parsedContent.passage,
      options: parsedContent.options,
      question_ids: insertedQuestions?.map((q: any) => q.id)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-gap-fill-passage:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
