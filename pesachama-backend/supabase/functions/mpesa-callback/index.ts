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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await req.json();

  // M-Pesa Callback Payload Structure (Simplified for simulation)
  // { "Body": { "stkCallback": { "CheckoutRequestID": "...", "ResultCode": 0, "CallbackMetadata": { "Item": [...] } } } }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Extract CheckoutRequestID from callback
  const checkoutRequestId = payload.Body.stkCallback.CheckoutRequestID;
  const resultCode = payload.Body.stkCallback.ResultCode;

  console.log(
    `Processing callback for CheckoutRequestID: ${checkoutRequestId}, ResultCode: ${resultCode}`,
  );

  if (resultCode === 0) {
    // Payment Successful
    const callbackMetadata = payload.Body.stkCallback.CallbackMetadata?.Item ||
      [];
    const mpesaReceipt = callbackMetadata.find((i: any) =>
      i.Name === "MpesaReceiptNumber"
    )?.Value;
    const phoneNumber = callbackMetadata.find((i: any) =>
      i.Name === "PhoneNumber"
    )?.Value;

    // Find the transaction with this checkout_request_id in metadata
    // We use a JSON containment check or just search.
    // Since we can't easily query inside JSONB array with simple syntax in some client versions,
    // best is if we had a column. But we put it in metadata.
    // We can use the arrow operator ->> for text comparison if supported by client filter,
    // or we might need to rely on the fact we store it.

    // Supabase JS filter for JSON: .eq('metadata->>checkout_request_id', checkoutRequestId) usually works

    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("id")
      .eq("metadata->>checkout_request_id", checkoutRequestId)
      .single();

    if (fetchError || !transaction) {
      console.error("Transaction not found for ID:", checkoutRequestId);
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update Transaction
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        mpesa_transaction_id: mpesaReceipt, // Storing receipt in correct column
        updated_at: new Date().toISOString(),
        payment_method: "mpesa", // Ensure this is set
      })
      .eq("id", transaction.id);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Payment confirmed for transaction ${transaction.id}`);
  } else {
    // Payment Failed/Cancelled
    const resultDesc = payload.Body.stkCallback.ResultDesc;

    // Find transaction
    const { data: transaction } = await supabase
      .from("transactions")
      .select("id")
      .eq("metadata->>checkout_request_id", checkoutRequestId)
      .single();

    if (transaction) {
      await supabase
        .from("transactions")
        .update({
          status: "failed",
          description: `Failed: ${resultDesc}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      console.log(
        `Payment failed for transaction ${transaction.id}: ${resultDesc}`,
      );
    } else {
      console.warn(
        `Payment failed for unknown transaction ${checkoutRequestId}`,
      );
    }
  }

  return new Response(JSON.stringify({ message: "Callback received" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
