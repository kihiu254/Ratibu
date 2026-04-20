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

const normalizeMsisdn = (value: string) => {
  const trimmed = value.replace(/[\s\-()]/g, "");
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  return null;
};

const resolveValidationFailure = (reason: string) => {
  if (reason === "msisdn") return { ResultCode: "C2B00011", ResultDesc: "Rejected" };
  if (reason === "bill_ref") return { ResultCode: "C2B00012", ResultDesc: "Rejected" };
  if (reason === "amount") return { ResultCode: "C2B00013", ResultDesc: "Rejected" };
  if (reason === "short_code") return { ResultCode: "C2B00015", ResultDesc: "Rejected" };
  return { ResultCode: "C2B00016", ResultDesc: "Rejected" };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse(resolveValidationFailure("other"));
    }

    const raw = payload as Record<string, unknown>;
    const transId = String(raw.TransID || raw.transId || crypto.randomUUID());
    const shortCode = String(raw.BusinessShortCode || raw.ShortCode || "");
    const billRefNumber = String(raw.BillRefNumber || raw.AccountReference || "");
    const amount = Number(raw.TransAmount || raw.Amount || 0);
    const msisdn = normalizeMsisdn(String(raw.MSISDN || raw.msisdn || ""));
    const expectedShortCode = String(
      Deno.env.get("MPESA_C2B_SHORTCODE") || Deno.env.get("MPESA_BUSINESS_SHORTCODE") || "",
    );

    if (!shortCode || (expectedShortCode && shortCode !== expectedShortCode)) {
      return jsonResponse(resolveValidationFailure("short_code"));
    }

    if (!msisdn) {
      return jsonResponse(resolveValidationFailure("msisdn"));
    }

    if (!billRefNumber.trim()) {
      return jsonResponse(resolveValidationFailure("bill_ref"));
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse(resolveValidationFailure("amount"));
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    await supabaseAdmin.from("mpesa_payment_events").upsert({
      direction: "c2b",
      status: "validated",
      request_reference: transId,
      transaction_id: transId,
      short_code: shortCode,
      phone_number: msisdn,
      bill_ref_number: billRefNumber,
      amount,
      raw_request: raw,
      raw_response: {
        validation: "accepted",
      },
      metadata: {
        transaction_type: raw.TransactionType ?? null,
        validation_received_at: new Date().toISOString(),
      },
    }, {
      onConflict: "request_reference",
    });

    return jsonResponse({
      ResultCode: "0",
      ResultDesc: "Accepted",
    });
  } catch (error: any) {
    console.error("C2B validation error:", error?.message || error);
    return jsonResponse(resolveValidationFailure("other"));
  }
});
