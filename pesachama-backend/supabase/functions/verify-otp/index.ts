import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(JSON.stringify({ error: "Email and code are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check if OTP is valid and not expired
    const { data, error: dbError } = await supabase
      .from("security_otps")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (dbError || !data) {
      console.warn(`Failed verification attempt for ${email} with code ${code}`);
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Mark OTP as used
    await supabase
      .from("security_otps")
      .update({ used: true })
      .eq("id", data.id);

    const verifiedAt = new Date().toISOString();
    const { error: profileError } = data.user_id
      ? await supabase
          .from("users")
          .update({ otp_verified_at: verifiedAt, updated_at: verifiedAt })
          .eq("id", data.user_id)
      : await supabase
          .from("users")
          .update({ otp_verified_at: verifiedAt, updated_at: verifiedAt })
          .eq("email", email);

    if (profileError) {
      console.warn("Failed to update otp_verified_at:", profileError);
    }

    console.log(`Successfully verified OTP for ${email}`);

    return new Response(JSON.stringify({ message: "OTP verified successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
