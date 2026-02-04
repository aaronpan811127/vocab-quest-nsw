import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: ContactFormRequest = await req.json();

    console.log(`Sending contact form email from ${email}`);

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "VocabQuest Contact <onboarding@resend.dev>",
      to: ["aaronpan@gmail.com"],
      replyTo: email,
      subject: `[VocabQuest Contact] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .field { margin-bottom: 20px; }
            .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .value { background: white; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .message-box { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎮 VocabQuest</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">New Contact Form Submission</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">From</div>
                <div class="value">${name} &lt;${email}&gt;</div>
              </div>
              
              <div class="field">
                <div class="label">Subject</div>
                <div class="value">${subject}</div>
              </div>
              
              <div class="field">
                <div class="label">Message</div>
                <div class="message-box">${message}</div>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                You can reply directly to this email to respond to ${name}.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Contact email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending contact email:", error);
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
