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
    const { unit_id, words } = await req.json();

    if (!unit_id || !words || !Array.isArray(words) || words.length === 0) {
      return new Response(
        JSON.stringify({ error: "unit_id and words array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Generate vocabulary data for these English words: ${words.join(", ")}

For each word, provide:
1. A clear, concise definition (1-2 sentences)
2. 2-3 synonyms
3. 1-2 antonyms (if applicable, otherwise empty array)
4. 2 example sentences using the word

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "word": "example",
    "definition": "A thing characteristic of its kind",
    "synonyms": ["instance", "sample"],
    "antonyms": ["exception"],
    "examples": ["This is an example sentence.", "Here's another example."]
  }
]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a vocabulary expert. Return only valid JSON with no markdown formatting or code blocks." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits needed. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate vocabulary");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON from the response
    let vocabularyData;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      vocabularyData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse vocabulary data");
    }

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const vocabRecords = vocabularyData.map((item: any) => ({
      unit_id,
      word: item.word,
      definition: item.definition,
      synonyms: item.synonyms || [],
      antonyms: item.antonyms || [],
      examples: item.examples || [],
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("vocabulary")
      .insert(vocabRecords)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save vocabulary data");
    }

    return new Response(
      JSON.stringify({ success: true, vocabulary: insertedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-vocabulary:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
