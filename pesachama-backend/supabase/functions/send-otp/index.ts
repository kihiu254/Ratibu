import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("SMTP_PASS"); // Reusing this as the API key
const EMAIL_FROM = Deno.env.get("SMTP_FROM");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { email, userId, fullName, purpose, force } = payload;

    console.log("Request Payload:", { email, userId, fullName });

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const normalizedPurpose = typeof purpose === "string" ? purpose : "generic";

    if (normalizedPurpose === "onboarding") {
      const profileQuery = userId
        ? supabase.from("users").select("otp_verified_at").eq("id", userId).maybeSingle()
        : supabase.from("users").select("otp_verified_at").eq("email", email).maybeSingle();

      const { data: profile, error: profileError } = await profileQuery;

      if (profileError) {
        console.warn("OTP check failed:", profileError);
      }

      if (profile?.otp_verified_at) {
        return new Response(JSON.stringify({ message: "OTP already verified", verified: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!force) {
        const { data: existingOtp } = await supabase
          .from("security_otps")
          .select("id, expires_at")
          .eq("email", email)
          .eq("used", false)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingOtp) {
          return new Response(JSON.stringify({ message: "OTP already sent", alreadySent: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 1. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    console.log(`Storing OTP for ${email}...`);
    // 2. Store OTP in database
    const { error: dbError } = await supabase.from("security_otps").insert([
      {
        user_id: userId || null,
        email: email,
        code: otp,
        expires_at: expiresAt.toISOString(),
      },
    ]);

    if (dbError) {
      console.error("Database Error:", dbError);
      throw new Error(`Database Error: ${dbError.message}`);
    }

    console.log("OTP stored successfully. Sending email via Resend API...");

    // 3. Send Email via Resend REST API
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      console.error("Missing Resend Config:", { key: !!RESEND_API_KEY, from: !!EMAIL_FROM });
      throw new Error("Missing email secrets (SMTP_PASS for API key or SMTP_FROM for sender).");
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Security Verification</title>
        <style>
          body { margin:0; padding:0; background:#f9fafb; color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          .container { width:100%; background:#f9fafb; padding: 40px 0; }
          .card { width:90%; max-width:560px; background:#ffffff; border-radius:24px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); margin: 0 auto; overflow: hidden; border: 1px solid #f1f5f9; }
          .header { padding: 40px 20px 20px; text-align: center; }
          .logo { height: 60px; width: auto; }
          .content { padding: 32px 40px 40px; text-align: center; }
          .headline { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 16px; tracking: -0.025em; }
          .text { font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
          .code-container { margin: 32px 0; }
          .code { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 42px; letter-spacing: 8px; background: #f0fdf4; padding: 20px 32px; border-radius: 16px; display: inline-block; color: #16a34a; font-weight: 700; border: 2px solid #bbf7d0; }
          .footer { padding: 24px; background: #f8fafc; color: #94a3b8; font-size: 14px; text-align: center; border-top: 1px solid #f1f5f9; }
          .footer a { color: #16a34a; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <img src="${SUPABASE_URL}/storage/v1/object/public/branding/logo-chama.png" alt="Ratibu Chama" class="logo">
            </div>
            <div class="content">
              <h1 class="headline">Security Verification</h1>
              <p class="text">Hello ${fullName || 'Member'},</p>
              <p class="text">To keep your account secure, please use the 6-digit verification code below:</p>
              <div class="code-container">
                <span class="code">${otp}</span>
              </div>
              <p class="text" style="font-size: 14px; margin-top: 32px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} <a href="https://ratibu.com">Ratibu Chama</a>. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Ratibu Chama <${EMAIL_FROM}>`,
        to: [email],
        subject: "Your Ratibu Security Code",
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API Error:", resendData);
      throw new Error(`Email service error: ${resendData.message || "Unknown error"}`);
    }

    console.log("Email sent successfully via Resend.");

    return new Response(JSON.stringify({ message: "OTP sent successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Critical Function Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
