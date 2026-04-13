import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

async function requireAdmin(supabase: any, token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("system_role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = String(profile?.system_role ?? "user");
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Admin access required");
  }

  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 500);
  }

  const token = getBearerToken(req.headers.get("Authorization"));
  if (!token) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const transactionId = String(payload.transactionId || "").trim();
  const amount = Number(payload.amount);
  const receiverParty = String(payload.receiverParty || "").trim();
  const remarks = String(payload.remarks || "Payment reversal").trim();

  if (!transactionId || !Number.isFinite(amount) || amount <= 0 || !receiverParty) {
    return jsonResponse({
      error: "transactionId, amount, and receiverParty are required",
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userId = await requireAdmin(supabase, token);

  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME");
  const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
  const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

  if (!consumerKey || !consumerSecret || !initiatorName || !securityCredential) {
    return jsonResponse({
      error: "Missing M-Pesa reversal credentials",
    }, 500);
  }

  const baseUrl = mpesaEnv === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  const authResp = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );

  if (!authResp.ok) {
    const errorText = await authResp.text();
    return jsonResponse({
      error: `Unable to authenticate with M-Pesa (${authResp.status})`,
      details: errorText,
    }, 500);
  }

  const { access_token } = await authResp.json();
  const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-reversal-callback`;
  const queueTimeoutUrl = `${SUPABASE_URL}/functions/v1/mpesa-reversal-callback`;

  const response = await fetch(`${baseUrl}/mpesa/reversal/v1/request`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "TransactionReversal",
      TransactionID: transactionId,
      Amount: String(Math.ceil(amount)),
      ReceiverParty: receiverParty,
      ReceiverIdentifierType: "11",
      RecieverIdentifierType: "11",
      ResultURL: callbackUrl,
      QueueTimeOutURL: queueTimeoutUrl,
      Remarks: remarks,
      Occasion: "Ratibu reversal request",
    }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : { raw: await response.text() };

  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "mpesa_reversal_requested",
    resource_type: "mpesa_reversal",
    resource_id: transactionId,
    old_value: null,
    new_value: {
      transaction_id: transactionId,
      amount,
      receiver_party: receiverParty,
      remarks,
      response: body,
    },
  });
  if (auditError) {
    console.warn("Failed to write reversal audit log:", auditError.message);
  }

  if (!response.ok) {
    return jsonResponse({
      error: body?.errorMessage || body?.error || "Failed to request reversal",
      details: body,
    }, response.status);
  }

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        targetUserId: userId,
        title: "Reversal requested",
        message: `Your reversal request for transaction ${transactionId} has been submitted.`,
        type: "info",
        link: "/reversals",
        emailSubject: "Ratibu reversal request submitted",
      }),
    });
  } catch (e) {
    console.warn("Failed to send reversal notification:", e);
  }

  return jsonResponse({
    success: true,
    data: body,
    requestedBy: userId,
  });
});
