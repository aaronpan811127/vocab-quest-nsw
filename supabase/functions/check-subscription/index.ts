import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIAL_DURATION_DAYS = 7;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

async function checkParentSubscription(
  supabaseClient: any,
  stripe: any,
  studentUserId: string
): Promise<{ productId: string | null; subscriptionEnd: string | null; billingInterval: 'monthly' | 'annual' | null } | null> {
  try {
    // Find if this student has a linked parent with an active relationship
    const { data: parentLinks, error: parentError } = await supabaseClient
      .from('parent_children')
      .select('parent_id')
      .eq('student_user_id', studentUserId)
      .eq('relationship_status', 'active');

    if (parentError || !parentLinks || parentLinks.length === 0) {
      logStep("No active parent links found for student", { studentUserId });
      return null;
    }

    // For each linked parent, check if they have an active Stripe subscription
    for (const link of parentLinks) {
      const { data: parentProfile, error: ppError } = await supabaseClient
        .from('parent_profiles')
        .select('user_id')
        .eq('id', link.parent_id)
        .single();

      if (ppError || !parentProfile) continue;

      // Get parent's email from auth.users
      const { data: parentUser, error: puError } = await supabaseClient
        .auth.admin.getUserById(parentProfile.user_id);

      if (puError || !parentUser?.user?.email) continue;

      const parentEmail = parentUser.user.email;
      logStep("Checking parent Stripe subscription", { parentEmail });

      const parentCustomers = await stripe.customers.list({ email: parentEmail, limit: 1 });
      if (parentCustomers.data.length === 0) continue;

      const parentCustomerId = parentCustomers.data[0].id;
      const parentSubscriptions = await stripe.subscriptions.list({
        customer: parentCustomerId,
        status: "active",
        limit: 1,
      });

      if (parentSubscriptions.data.length > 0) {
        const sub = parentSubscriptions.data[0];
        const priceItem = sub.items.data[0]?.price;
        const periodEnd = sub.current_period_end;
        let subscriptionEnd = null;
        if (periodEnd && typeof periodEnd === 'number') {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        }
        
        let billingInterval: 'monthly' | 'annual' | null = null;
        const interval = priceItem?.recurring?.interval;
        if (interval === 'year') billingInterval = 'annual';
        else if (interval === 'month') billingInterval = 'monthly';

        // Also update the parent_profiles subscription status
        await supabaseClient
          .from('parent_profiles')
          .update({ 
            subscription_status: 'active', 
            subscription_tier: 'premium',
            updated_at: new Date().toISOString()
          })
          .eq('id', link.parent_id);

        return {
          productId: priceItem?.product ?? null,
          subscriptionEnd,
          billingInterval,
        };
      }
    }

    return null;
  } catch (err) {
    logStep("Error checking parent subscription", { error: String(err) });
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header - returning free tier for unauthenticated request");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: 'free',
        product_id: null,
        subscription_end: null,
        is_trial_active: false,
        trial_days_remaining: 0,
        trial_expired: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    // Use anon key client for getClaims (signing-keys compatible)
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.email) {
      logStep("Auth failed or session expired - returning free tier", { error: claimsError?.message });
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: 'free',
        product_id: null,
        subscription_end: null,
        is_trial_active: false,
        trial_days_remaining: 0,
        trial_expired: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch user profile to get trial_started_at
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('trial_started_at, created_at')
      .eq('user_id', user.id)
      .single();

    let isTrialActive = false;
    let trialDaysRemaining = 0;
    let trialExpired = true;

    if (profileData) {
      const trialStartedAt = profileData.trial_started_at || profileData.created_at;
      if (trialStartedAt) {
        const trialStart = new Date(trialStartedAt);
        const now = new Date();
        const daysSinceTrialStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, TRIAL_DURATION_DAYS - daysSinceTrialStart);
        isTrialActive = trialDaysRemaining > 0;
        trialExpired = trialDaysRemaining <= 0;
        logStep("Trial status calculated", { trialStartedAt, daysSinceTrialStart, trialDaysRemaining, isTrialActive });
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found for user, checking parent subscription");
      
      // Check if this student has a linked parent with an active subscription
      const parentSub = await checkParentSubscription(supabaseClient, stripe, user.id);
      if (parentSub) {
        logStep("Parent has active subscription, granting premium to student", parentSub);
        return new Response(JSON.stringify({ 
          subscribed: true,
          tier: 'premium',
          product_id: parentSub.productId,
          subscription_end: parentSub.subscriptionEnd,
          billing_interval: parentSub.billingInterval,
          is_trial_active: false,
          trial_days_remaining: 0,
          trial_expired: true,
          via_parent: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      logStep("No parent subscription found either, returning free tier with trial status");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: 'free',
        product_id: null,
        subscription_end: null,
        is_trial_active: isTrialActive,
        trial_days_remaining: trialDaysRemaining,
        trial_expired: trialExpired
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    logStep("Subscriptions query result", { count: subscriptions.data.length });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let tier = 'free';
    let billingInterval: 'monthly' | 'annual' | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      const periodEnd = subscription.current_period_end;
      if (periodEnd && typeof periodEnd === 'number') {
        subscriptionEnd = new Date(periodEnd * 1000).toISOString();
      }
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      const priceItem = subscription.items.data[0]?.price;
      productId = priceItem?.product ?? null;
      tier = 'premium';
      
      // When user has active subscription, trial no longer applies
      isTrialActive = false;
      trialExpired = true;
      trialDaysRemaining = 0;
      
      // Determine billing interval from the price
      const interval = priceItem?.recurring?.interval;
      if (interval === 'year') {
        billingInterval = 'annual';
      } else if (interval === 'month') {
        billingInterval = 'monthly';
      }
      
      logStep("Determined subscription tier", { productId, tier, billingInterval });
    } else {
      logStep("No active subscription for user, checking parent subscription");
      
      // Check if this student has a linked parent with an active subscription
      const parentSub = await checkParentSubscription(supabaseClient, stripe, user.id);
      if (parentSub) {
        logStep("Parent has active subscription, granting premium to student", parentSub);
        return new Response(JSON.stringify({ 
          subscribed: true,
          tier: 'premium',
          product_id: parentSub.productId,
          subscription_end: parentSub.subscriptionEnd,
          billing_interval: parentSub.billingInterval,
          is_trial_active: false,
          trial_days_remaining: 0,
          trial_expired: true,
          via_parent: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      logStep("No parent subscription found, returning free tier with trial status");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd,
      billing_interval: billingInterval,
      is_trial_active: isTrialActive,
      trial_days_remaining: trialDaysRemaining,
      trial_expired: trialExpired
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
