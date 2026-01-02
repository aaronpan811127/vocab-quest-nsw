import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Magic bytes for common image formats
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header, followed by WEBP
};

function validateImageMagicBytes(bytes: Uint8Array): { valid: boolean; detectedType: string | null } {
  for (const [mimeType, signatures] of Object.entries(IMAGE_SIGNATURES)) {
    for (const sig of signatures) {
      if (bytes.length >= sig.length) {
        let match = true;
        for (let i = 0; i < sig.length; i++) {
          if (bytes[i] !== sig[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          // Additional check for WebP
          if (mimeType === 'image/webp') {
            if (bytes.length >= 12) {
              const webpMarker = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
              if (webpMarker !== 'WEBP') {
                continue;
              }
            } else {
              continue;
            }
          }
          return { valid: true, detectedType: mimeType };
        }
      }
    }
  }
  return { valid: false, detectedType: null };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
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

    // Client with user's JWT
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      return new Response(
        JSON.stringify({ success: false, error: 'File too large. Maximum size is 2MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Validate magic bytes to ensure it's actually an image
    const { valid, detectedType } = validateImageMagicBytes(bytes);
    if (!valid) {
      console.error('Invalid file type - magic bytes check failed');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Detected image type:', detectedType);

    // Determine file extension from detected type
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = extMap[detectedType!] || 'jpg';
    const filePath = `${user.id}/avatar.${ext}`;

    // Upload with service role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, bytes, { 
        upsert: true,
        contentType: detectedType!
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload avatar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Add cache-busting param
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Update user profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Avatar uploaded successfully:', avatarUrl);
    return new Response(
      JSON.stringify({ success: true, avatar_url: avatarUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
