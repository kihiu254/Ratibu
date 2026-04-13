import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await req.json().catch(() => null);
  console.log("M-Pesa reversal callback:", JSON.stringify(payload));

  const result = payload?.Result;
  const transactionId = result?.TransactionID || result?.ResultParameters?.ResultParameter?.find?.((item: any) => item.Key === "OriginalTransactionID")?.Value;
  if (transactionId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: audit } = await supabase
        .from("audit_logs")
        .select("user_id")
        .eq("action", "mpesa_reversal_requested")
        .eq("resource_id", String(transactionId))
        .maybeSingle();

      const userId = audit?.user_id;
      if (userId) {
        await fetch(`${SUPABASE_URL}/functions/v1/notify-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            targetUserId: userId,
            title: result?.ResultCode === 0 ? "Reversal completed" : "Reversal failed",
            message: result?.ResultCode === 0
              ? "Your M-Pesa reversal request was processed successfully."
              : `Your M-Pesa reversal request failed: ${result?.ResultDesc || "Unknown reason"}`,
            type: result?.ResultCode === 0 ? "success" : "warning",
            link: "/reversals",
            emailSubject: result?.ResultCode === 0 ? "Ratibu reversal completed" : "Ratibu reversal failed",
          }),
        });
      }
    } catch (e) {
      console.warn("Failed to send reversal callback notification:", e);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
