import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Simple in-memory rate limiting (per email, 5 requests per hour)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(email: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Server-side input validation (matches client-side Zod schema)
function validateInput(data: ContactFormRequest): { valid: boolean; error?: string } {
  const { name, email, subject, message } = data;

  // Check required fields
  if (!name || !email || !subject || !message) {
    return { valid: false, error: "Missing required fields" };
  }

  // Validate name (1-100 chars)
  const trimmedName = String(name).trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    return { valid: false, error: "Name must be between 1 and 100 characters" };
  }

  // Validate email format and length (max 255 chars)
  const trimmedEmail = String(email).trim();
  if (trimmedEmail.length > 255) {
    return { valid: false, error: "Email must be less than 255 characters" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: "Invalid email format" };
  }

  // Validate subject (1-200 chars)
  const trimmedSubject = String(subject).trim();
  if (trimmedSubject.length < 1 || trimmedSubject.length > 200) {
    return { valid: false, error: "Subject must be between 1 and 200 characters" };
  }

  // Validate message (10-2000 chars)
  const trimmedMessage = String(message).trim();
  if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
    return { valid: false, error: "Message must be between 10 and 2000 characters" };
  }

  return { valid: true };
}

// HTML escape function to prevent XSS in email content
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(text).replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { name, email, subject, message } = body as ContactFormRequest;

    console.log(`Contact form submission from: ${email?.substring(0, 50)}...`);

    // Server-side validation
    const validation = validateInput({ name, email, subject, message });
    if (!validation.valid) {
      console.log(`Validation failed: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Rate limiting check
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for email: ${email?.substring(0, 20)}...`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json", 
            "Retry-After": "3600",
            ...corsHeaders 
          },
        }
      );
    }

    // Sanitize inputs for HTML email
    const safeName = escapeHtml(name.trim());
    const safeEmail = escapeHtml(email.trim());
    const safeSubject = escapeHtml(subject.trim());
    const safeMessage = escapeHtml(message.trim());

    const emailResponse = await resend.emails.send({
      from: "VocabQuests <info@vocabquests.com>",
      to: ["info@vocabquests.com"],
      replyTo: email.trim(),
      subject: `[VocabQuests Contact] ${safeSubject}`,
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
                <div class="value">${safeName} &lt;${safeEmail}&gt;</div>
              </div>
              
              <div class="field">
                <div class="label">Subject</div>
                <div class="value">${safeSubject}</div>
              </div>
              
              <div class="field">
                <div class="label">Message</div>
                <div class="message-box">${safeMessage}</div>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                You can reply directly to this email to respond to ${safeName}.
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
      JSON.stringify({ error: "Failed to send message. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
