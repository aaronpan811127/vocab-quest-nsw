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

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.log("Invalid user token:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id);

    const { unit_id, words } = await req.json();

    if (!unit_id || !words || !Array.isArray(words) || words.length === 0) {
      return new Response(JSON.stringify({ error: "unit_id and words array are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (words.length > 20) {
      return new Response(JSON.stringify({ error: "Maximum 20 words allowed per request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to check existing questions
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check which words already have questions in this unit
    const intuitionGameId = '05155f78-2977-44cd-8d77-b6ec5a7b78cc';
    const { data: existingQuestions, error: fetchError } = await supabase
      .from("question_bank")
      .select("id, question_text, correct_answer, options, word")
      .eq("unit_id", unit_id)
      .eq("game_id", intuitionGameId);

    if (fetchError) {
      console.error("Error fetching existing questions:", fetchError);
      throw new Error("Failed to check existing questions");
    }

    // Extract words that already have questions from the word column
    const existingWords = new Set<string>();
    existingQuestions?.forEach((q) => {
      if (q.word) {
        existingWords.add(q.word.toLowerCase());
      } else {
        // Fallback for legacy data: try to get word from options
        try {
          const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
          if (options?.word) {
            existingWords.add(options.word.toLowerCase());
          }
        } catch (e) {
          console.error("Error parsing options:", e);
        }
      }
    });

    // Filter out words that already have questions
    const wordsToGenerate = words.filter((word: string) => !existingWords.has(word.toLowerCase()));

    console.log("Existing words:", Array.from(existingWords));
    console.log("Words to generate:", wordsToGenerate);

    // If all words already have questions, return existing ones
    if (wordsToGenerate.length === 0) {
      console.log("All words already have questions, returning existing");
      return new Response(JSON.stringify({ success: true, questions: existingQuestions, skipped: words }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Generate word intuition questions for these vocabulary words: ${wordsToGenerate.join(", ")}

For each word, create a question where:
1. The word is used naturally in a sentence context that clearly shows its connotation
2. The student must identify if the word feels positive, negative, or neutral in that context
3. The sentence should be age-appropriate for students (grades 5-12)
4. DO NOT use any markdown formatting like asterisks or bold - just write the plain sentence with the word included naturally

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "word": "reluctant",
    "sentence": "The judge was reluctant to accept the argument without solid evidence.",
    "correct_answer": "negative",
    "explanation": "In this context, reluctant shows hesitation and unwillingness, which carries a negative connotation as it implies doubt or resistance."
  },
  {
    "word": "diligent",
    "sentence": "The diligent student spent extra hours reviewing the material before the exam.",
    "correct_answer": "positive",
    "explanation": "Here diligent describes someone who is hardworking and careful, which is a positive quality."
  }
]

The options are always: "positive", "negative", "neutral"
Make sure each sentence clearly demonstrates the word's connotation in that specific context.
IMPORTANT: Write plain sentences without any special formatting or markdown.`;

    console.log("Generating intuition questions for words:", wordsToGenerate);

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
            content: "You are a vocabulary expert creating educational content. Return only valid JSON with no markdown formatting or code blocks.",
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
      throw new Error("Failed to generate intuition questions");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let questionsData;
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

    // supabase client already created above

    const intuitionGameId = '05155f78-2977-44cd-8d77-b6ec5a7b78cc';
    const questionRecords = questionsData.map((item: any) => ({
      unit_id,
      game_id: intuitionGameId,
      word: item.word.toLowerCase(),
      question_text: item.sentence,
      correct_answer: item.correct_answer,
      options: JSON.stringify({
        word: item.word,
        choices: ["positive", "negative", "neutral"],
        explanation: item.explanation,
      }),
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("question_bank")
      .insert(questionRecords)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save questions data");
    }

    console.log("Successfully generated and saved", insertedData?.length, "intuition questions");

    // Combine existing and new questions for response
    const allQuestions = [...(existingQuestions || []), ...(insertedData || [])];

    return new Response(JSON.stringify({ 
      success: true, 
      questions: allQuestions,
      generated: insertedData?.length || 0,
      skipped: words.filter((w: string) => existingWords.has(w.toLowerCase()))
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-intuition-questions:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
