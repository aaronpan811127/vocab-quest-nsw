import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChildLinkNotificationRequest {
  childEmail: string;
  childName: string;
  parentName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { childEmail, childName, parentName }: ChildLinkNotificationRequest = await req.json();

    console.log(`Sending child link notification to ${childEmail}`);

    if (!childEmail || !parentName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "VocabQuest <onboarding@resend.dev>",
      to: [childEmail],
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
              <p>Hi ${childName || 'there'}! 👋</p>
              
              <p>Great news! <strong>${parentName}</strong> has linked their parent account to your VocabQuest profile.</p>
              
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending child link notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
