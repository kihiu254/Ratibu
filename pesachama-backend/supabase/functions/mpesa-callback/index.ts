import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await req.json().catch(() => null);
  const callback = payload?.Body?.stkCallback;

  if (!callback?.CheckoutRequestID) {
    return jsonResponse({ error: "Invalid callback payload" }, 400);
  }

  const checkoutRequestId = callback.CheckoutRequestID;
  const resultCode = callback.ResultCode;

  console.log(
    `Processing callback for CheckoutRequestID: ${checkoutRequestId}, ResultCode: ${resultCode}`,
  );

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: transaction, error: fetchError } = await supabase
    .from("transactions")
    .select("id, status, metadata")
    .eq("metadata->>checkout_request_id", checkoutRequestId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch transaction:", fetchError);
    return jsonResponse({ error: fetchError.message }, 500);
  }

  if (!transaction) {
    console.warn("Transaction not found for checkout request:", checkoutRequestId);
    return jsonResponse({ message: "Callback acknowledged without matching transaction" });
  }

  if (resultCode === 0) {
    if (transaction.status === "completed") {
      return jsonResponse({ message: "Callback already processed" });
    }

    const callbackMetadata = callback.CallbackMetadata?.Item || [];
    const mpesaReceipt = callbackMetadata.find((item: any) =>
      item.Name === "MpesaReceiptNumber"
    )?.Value;
    const phoneNumber = callbackMetadata.find((item: any) =>
      item.Name === "PhoneNumber"
    )?.Value;

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        mpesa_transaction_id: mpesaReceipt,
        updated_at: new Date().toISOString(),
        payment_method: "mpesa",
        metadata: {
          ...(transaction.metadata ?? {}),
          callback_phone_number: phoneNumber ?? null,
          callback_processed_at: new Date().toISOString(),
          result_code: resultCode,
        },
      })
      .eq("id", transaction.id);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
      return jsonResponse({ error: updateError.message }, 500);
    }
  } else if (transaction.status !== "completed") {
    const resultDesc = callback.ResultDesc || "Payment failed";

    const { error: failureUpdateError } = await supabase
      .from("transactions")
      .update({
        status: "failed",
        description: `Failed: ${resultDesc}`,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(transaction.metadata ?? {}),
          callback_processed_at: new Date().toISOString(),
          result_code: resultCode,
          result_description: resultDesc,
        },
      })
      .eq("id", transaction.id);

    if (failureUpdateError) {
      console.error("Failed to record failed callback:", failureUpdateError);
      return jsonResponse({ error: failureUpdateError.message }, 500);
    }
  }

  return jsonResponse({ message: "Callback received" });
});
