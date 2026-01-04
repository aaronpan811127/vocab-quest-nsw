import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// No limit on generated passages

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get authorization header to extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client with user's JWT to verify auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { unit_id, unit_title } = await req.json();

    if (!unit_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing unit_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`User ${user.id} generating new passage for unit: ${unit_id}`);

    // Get unit words to incorporate into the passage
    const { data: unitData } = await supabaseAdmin
      .from('units')
      .select('words, title')
      .eq('id', unit_id)
      .single();

    const vocabularyWords = unitData?.words || [];
    const unitTitleToUse = unit_title || unitData?.title || 'Vocabulary Practice';

    console.log('Generating passage for unit:', unitTitleToUse, 'with', vocabularyWords.length, 'vocabulary words');

    // Call Lovable AI Gateway to generate passage with questions
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
            content: `You are an expert educational content creator specializing in reading comprehension passages for NSW selective school preparation. 

Your task is to create an engaging reading passage and 10 multiple-choice comprehension questions. The passage should:
1. Be 200-300 words long
2. Be appropriate for students aged 10-12
3. Include interesting, educational content
4. If vocabulary words are provided, naturally incorporate some of them
5. Have a clear theme and narrative

Each question should:
1. Test vocabulary understanding, inference, or comprehension skills
2. Have exactly 4 answer options
3. Have one clearly correct answer
4. Vary in difficulty (mix of literal, inferential, and evaluative questions)

You MUST respond with ONLY valid JSON. No other text, no markdown.`
          },
          {
            role: "user",
            content: `Create a reading passage and 10 comprehension questions for the unit: "${unitTitleToUse}"

${vocabularyWords.length > 0 ? `Try to naturally incorporate some of these vocabulary words: ${JSON.stringify(vocabularyWords)}` : ''}

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "passage": {
    "title": "An engaging title for the passage",
    "content": "The full passage text here. Use **word** to highlight important vocabulary words."
  },
  "questions": [
    {
      "question_text": "The question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A"
    }
  ]
}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      throw new Error('Failed to generate content');
    }

    console.log('AI response content:', content.substring(0, 200) + '...');

    // Parse the JSON from the response
    let generatedContent;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      generatedContent = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      throw new Error('Failed to parse generated content');
    }

    if (!generatedContent.passage || !generatedContent.questions || !Array.isArray(generatedContent.questions)) {
      console.error('Invalid content structure:', generatedContent);
      throw new Error('Invalid content structure');
    }

    if (generatedContent.questions.length < 10) {
      console.warn('Generated fewer than 10 questions:', generatedContent.questions.length);
    }

    // Insert the generated passage
    const { data: insertedPassage, error: passageError } = await supabaseAdmin
      .from('reading_passages')
      .insert({
        unit_id,
        title: generatedContent.passage.title,
        content: generatedContent.passage.content,
        highlighted_words: [],
        generated_by: user.id,
        is_generated: true,
      })
      .select()
      .single();

    if (passageError) {
      console.error('Error inserting passage:', passageError);
      throw new Error('Failed to save generated passage');
    }

    console.log('Inserted passage:', insertedPassage.id);

    // Insert the generated questions
    const questionsToInsert = generatedContent.questions.map((q: any) => ({
      passage_id: insertedPassage.id,
      unit_id,
      game_type: 'reading',
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
    }));

    const { data: insertedQuestions, error: questionsError } = await supabaseAdmin
      .from('question_bank')
      .insert(questionsToInsert)
      .select();

    if (questionsError) {
      console.error('Error inserting questions:', questionsError);
      // Clean up the passage if questions failed
      await supabaseAdmin.from('reading_passages').delete().eq('id', insertedPassage.id);
      throw new Error('Failed to save generated questions');
    }

    console.log('Successfully generated passage with', insertedQuestions?.length, 'questions');

    return new Response(
      JSON.stringify({ 
        success: true, 
        passage: insertedPassage,
        questions: insertedQuestions,
        questions_count: insertedQuestions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating passage:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
