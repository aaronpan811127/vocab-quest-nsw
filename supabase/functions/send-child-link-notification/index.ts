import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChildLinkNotificationRequest {
  childEmail: string;
  childName?: string;
  parentName?: string;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AuthN: require a valid JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const callerId = claimsData.claims.sub as string;

    // Parse body just to identify which child the caller wants to notify
    const { childEmail: requestedChildEmail }: ChildLinkNotificationRequest =
      await req.json().catch(() => ({} as ChildLinkNotificationRequest));

    if (!requestedChildEmail || typeof requestedChildEmail !== "string") {
      return new Response(JSON.stringify({ error: "Missing childEmail" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- AuthZ: caller must be a parent who owns the link to this child ---
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: parentProfile, error: parentErr } = await admin
      .from("parent_profiles")
      .select("id, parent_name")
      .eq("user_id", callerId)
      .maybeSingle();

    if (parentErr || !parentProfile) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Resolve child user from email (server-side, ignore client-supplied identity)
    const { data: childUserList, error: childUserErr } = await admin.auth.admin
      .listUsers({ page: 1, perPage: 200 });
    if (childUserErr) {
      throw childUserErr;
    }
    const childUser = childUserList?.users?.find(
      (u) => (u.email || "").toLowerCase() === requestedChildEmail.toLowerCase()
    );
    if (!childUser) {
      return new Response(JSON.stringify({ error: "Child not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: link, error: linkErr } = await admin
      .from("parent_children")
      .select("id")
      .eq("parent_id", parentProfile.id)
      .eq("student_user_id", childUser.id)
      .eq("relationship_status", "active")
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get the child's display name from their profile (server-side, trusted)
    const { data: childProfile } = await admin
      .from("profiles")
      .select("username")
      .eq("user_id", childUser.id)
      .maybeSingle();

    const safeChildName = escapeHtml(childProfile?.username || "there");
    const safeParentName = escapeHtml(parentProfile.parent_name || "Your parent");
    const safeChildEmail = childUser.email!;

    const emailResponse = await resend.emails.send({
      from: "VocabQuest <onboarding@resend.dev>",
      to: [safeChildEmail],
      subject: "Your VocabQuest account has been linked to a parent",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .highlight { background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎮 VocabQuest</h1>
              <p>Parent Account Linked</p>
            </div>
            <div class="content">
              <p>Hi ${safeChildName}! 👋</p>
              <p>Great news! <strong>${safeParentName}</strong> has linked their parent account to your VocabQuest profile.</p>
              <div class="highlight">
                <p><strong>What does this mean?</strong></p>
                <ul>
                  <li>Your parent can now view your learning progress</li>
                  <li>They can see your achievements and streaks</li>
                  <li>Your login credentials remain the same</li>
                </ul>
              </div>
              <p>Keep up the great work on your vocabulary journey! 📚✨</p>
              <p>Happy learning,<br>The VocabQuest Team</p>
            </div>
            <div class="footer">
              <p>If you have any questions, please contact your parent.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending child link notification:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
