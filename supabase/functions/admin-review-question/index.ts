import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get admin user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { p_user_id: adminUser.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { question_id, action, score, rejection_reason } = await req.json();

    if (!question_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing question_id or action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['approve', 'reject', 'score'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be approve, reject, or score' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${adminUser.id} reviewing question ${question_id} with action: ${action}`);

    const updateData: Record<string, unknown> = {
      reviewed_by: adminUser.id,
      reviewed_at: new Date().toISOString()
    };

    if (action === 'approve') {
      updateData.review_status = 'approved';
    } else if (action === 'reject') {
      updateData.review_status = 'rejected';
      updateData.rejection_reason = rejection_reason || null;
    } else if (action === 'score') {
      if (typeof score !== 'number' || score < 0 || score > 10) {
        return new Response(
          JSON.stringify({ error: 'Score must be a number between 0 and 10' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updateData.review_score = score;
    }

    const { data, error } = await supabase
      .from('question_bank')
      .update(updateData)
      .eq('id', question_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating question:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update question' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully reviewed question ${question_id}`);

    return new Response(
      JSON.stringify({ success: true, question: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-review-question:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
