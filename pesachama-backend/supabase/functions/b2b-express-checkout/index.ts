import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMpesaAccessToken, getMpesaBaseUrl, normalizeMpesaPhoneNumber } from "../_shared/daraja.ts";

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

async function requireAuthenticatedUser(authHeader: string | null) {
  const token = getBearerToken(authHeader);
  if (!token) {
    throw new Error("Missing bearer token");
  }

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { source: "internal" as const };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized request");
  }

  return { source: "user" as const, userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const auth = await requireAuthenticatedUser(authHeader);
    const payload = await req.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }

    const raw = payload as Record<string, unknown>;
    const primaryShortCode = String(raw.primaryShortCode || raw.PrimaryShortCode || "");
    const receiverShortCode = String(raw.receiverShortCode || raw.ReceiverShortCode || "");
    const amount = Number(raw.amount || raw.Amount || 0);
    const paymentRef = String(raw.paymentRef || raw.PaymentRef || "");
    const partnerName = String(raw.partnerName || raw.PartnerName || "Ratibu Vendor");
    const requestRefId = String(raw.RequestRefID || raw.requestRefId || raw.requestId || crypto.randomUUID());
    const callbackUrl = String(raw.callbackUrl || raw.CallbackUrl || `${SUPABASE_URL}/functions/v1/status-callback`);
    const phoneNumber = String(raw.phoneNumber || raw.PhoneNumber || "");

    if (!primaryShortCode || !receiverShortCode || !paymentRef || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({
        error: "Missing required fields: primaryShortCode, receiverShortCode, amount, paymentRef",
      }, 400);
    }

    const normalizedPhone = phoneNumber ? normalizeMpesaPhoneNumber(phoneNumber) : null;
    if (phoneNumber && !normalizedPhone) {
      return jsonResponse({ error: "Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userId = auth.source === "user" ? auth.userId : String(raw.userId || "");
    const chamaId = String(raw.chamaId || "");

    await supabase.from("mpesa_payment_events").upsert({
      direction: "b2b",
      status: "initiated",
      user_id: userId || null,
      chama_id: chamaId || null,
      request_reference: requestRefId,
      short_code: primaryShortCode,
      counterparty_short_code: receiverShortCode,
      amount,
      partner_name: partnerName,
      phone_number: normalizedPhone,
      metadata: {
        callback_url: callbackUrl,
        request_ref_id: requestRefId,
        source: "b2b-express-checkout",
      },
      raw_request: raw,
    }, {
      onConflict: "request_reference",
    });

    const accessToken = Deno.env.get("MPESA_ACCESS_TOKEN") || await getMpesaAccessToken();
    const response = await fetch(`${getMpesaBaseUrl()}/v1/ussdpush/get-msisdn`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        primaryShortCode,
        receiverShortCode,
        amount: String(amount),
        paymentRef,
        callbackUrl,
        partnerName,
        RequestRefID: requestRefId,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    const responseData = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      throw new Error(
        typeof responseData === "string"
          ? responseData
          : (responseData as Record<string, unknown> | null)?.status?.toString() ||
            (responseData as Record<string, unknown> | null)?.message?.toString() ||
            `B2B express checkout failed with status ${response.status}`,
      );
    }

    await supabase.from("mpesa_payment_events").update({
      raw_response: responseData && typeof responseData === "object" ? responseData : { response: responseData },
      updated_at: new Date().toISOString(),
    }).eq("request_reference", requestRefId);

    return jsonResponse({
      success: true,
      requestRefId,
      data: responseData,
    });
  } catch (error: any) {
    console.error("B2B express checkout error:", error?.message || error);
    return jsonResponse({
      success: false,
      error: error.message || "B2B express checkout failed",
    }, 400);
  }
});
