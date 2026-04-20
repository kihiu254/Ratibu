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

function buildDescription(payload: Record<string, unknown>) {
  const transactionType = String(payload.TransactionType || "C2B payment");
  const billRef = String(payload.BillRefNumber || payload.AccountReference || "");
  const amount = Number(payload.TransAmount || 0);
  return `${transactionType} of KES ${amount.toLocaleString()} for ${billRef}`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "Invalid confirmation payload" }, 400);
    }

    const raw = payload as Record<string, unknown>;
    const transId = String(raw.TransID || raw.transId || crypto.randomUUID());
    const shortCode = String(raw.BusinessShortCode || raw.ShortCode || "");
    const billRefNumber = String(raw.BillRefNumber || raw.AccountReference || "");
    const amount = Number(raw.TransAmount || raw.Amount || 0);
    const msisdn = normalizeMsisdn(String(raw.MSISDN || raw.msisdn || ""));
    const firstName = String(raw.FirstName || "");
    const middleName = String(raw.MiddleName || "");
    const lastName = String(raw.LastName || "");

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const eventRecord = {
      direction: "c2b",
      status: "completed",
      request_reference: transId,
      transaction_id: transId,
      short_code: shortCode,
      phone_number: msisdn,
      bill_ref_number: billRefNumber,
      amount,
      result_code: "0",
      result_desc: "Accepted",
      raw_callback: raw,
      metadata: {
        transaction_type: raw.TransactionType ?? null,
        first_name: firstName || null,
        middle_name: middleName || null,
        last_name: lastName || null,
        confirmation_received_at: new Date().toISOString(),
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("mpesa_payment_events").upsert(eventRecord, {
      onConflict: "request_reference",
    });

    const maybeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      billRefNumber,
    ) ? billRefNumber : null;

    if (maybeUuid) {
      const { data: chama } = await supabaseAdmin
        .from("chamas")
        .select("id, created_by")
        .eq("id", maybeUuid)
        .maybeSingle();

      if (chama?.id && chama.created_by) {
        const { data: existingTransaction } = await supabaseAdmin
          .from("transactions")
          .select("id")
          .eq("reference", transId)
          .maybeSingle();

        if (existingTransaction) {
          return jsonResponse({
            ResultCode: "0",
            ResultDesc: "Accepted",
          });
        }

        const { error: transactionInsertError } = await supabaseAdmin.from("transactions").insert({
          chama_id: chama.id,
          user_id: chama.created_by,
          type: "deposit",
          amount,
          status: "completed",
          payment_method: "mpesa",
          reference: transId,
          mpesa_transaction_id: transId,
          description: buildDescription(raw),
          metadata: {
            direction: "c2b",
            bill_ref_number: billRefNumber,
            phone_number: msisdn,
            short_code: shortCode,
            source: "c2b-confirmation",
            raw_callback: raw,
          },
        });
        if (transactionInsertError) {
          console.error(
            "Failed to create chama transaction from C2B confirmation:",
            transactionInsertError,
          );
        }
      }
    }

    return jsonResponse({
      ResultCode: "0",
      ResultDesc: "Accepted",
    });
  } catch (error: any) {
    console.error("C2B confirmation error:", error?.message || error);
    return jsonResponse({ error: error.message || "Confirmation processing failed" }, 500);
  }
});
