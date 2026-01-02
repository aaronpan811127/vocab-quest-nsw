import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word, sentence } = await req.json();

    if (!word || !sentence) {
      return new Response(
        JSON.stringify({ error: 'Word and sentence are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `You are evaluating if a student correctly used a vocabulary word in a sentence.

Word: "${word}"
Student's sentence: "${sentence}"

Evaluate if:
1. The word "${word}" (or a valid form like plural/past tense) is actually used in the sentence
2. The word is used correctly in context (grammatically and semantically)
3. The sentence makes sense

Respond with a JSON object:
{
  "isCorrect": true/false,
  "feedback": "Brief feedback explaining why the sentence is correct or what could be improved"
}

Be encouraging but accurate. If the word is not used at all, mark as incorrect. If used but with minor issues, still give credit if the meaning is clear.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response from the AI
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback: simple check if word is in sentence
      const wordInSentence = sentence.toLowerCase().includes(word.toLowerCase());
      result = {
        isCorrect: wordInSentence && sentence.trim().length > word.length + 10,
        feedback: wordInSentence 
          ? "Good use of the vocabulary word!" 
          : `Remember to use the word "${word}" in your sentence.`
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evaluate-sentence:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        isCorrect: false,
        feedback: 'Unable to evaluate. Please try again.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
