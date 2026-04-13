import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFirebasePush } from "../_shared/firebase.ts";

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

async function sendPush(
  supabase: any,
  userId: string,
  title: string,
  body: string,
) {
  const { data: tokens } = await supabase
    .from("user_fcm_tokens")
    .select("token")
    .eq("user_id", userId);

  if (!tokens?.length) return;

  for (const { token } of tokens) {
    try {
      await sendFirebasePush(token, title, body);
    } catch (e) {
      console.error("FCM error:", e);
    }
  }
}

async function insertNotification(
  supabase: any,
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string | null,
) {
  const { error } = await (supabase.from("notifications") as any).insert({
    user_id: userId,
    title,
    message,
    type,
    is_read: false,
    link: link ?? null,
  });

  if (error) {
    console.error("Failed to insert notification:", error);
  }
}

function buildNotificationCopy(transaction: {
  type?: string | null;
  description?: string | null;
  amount?: number | string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const amount = Number(transaction.amount ?? 0);
  const txType = String(transaction.type ?? "");
  const destination = String(transaction.metadata?.destination ?? "");
  const billName = transaction.metadata?.bill_name?.toString() ?? "Bill payment";
  const savingsName = transaction.metadata?.savings_target_name?.toString() ?? "Savings";
  const chamaName = transaction.metadata?.chama_name?.toString() ?? "Chama";

  if (destination === "bill_payment" || txType === "bill_payment") {
    return {
      successTitle: "Bill payment completed",
      successBody: `${billName} of KES ${amount.toLocaleString()} was completed successfully.`,
      failureTitle: "Bill payment failed",
      failureBody: `${billName} of KES ${amount.toLocaleString()} failed.`,
      link: "/kplc-bill",
      type: "info",
    };
  }

  if (destination === "mshwari" || txType === "mshwari_deposit") {
    return {
      successTitle: "Mshwari deposit completed",
      successBody: `KES ${amount.toLocaleString()} was sent to Mshwari successfully.`,
      failureTitle: "Mshwari deposit failed",
      failureBody: `KES ${amount.toLocaleString()} to Mshwari failed.`,
      link: "/accounts",
      type: "info",
    };
  }

  if (transaction.metadata?.savings_target_name) {
    return {
      successTitle: "Savings updated",
      successBody: `KES ${amount.toLocaleString()} has been processed for ${savingsName}.`,
      failureTitle: "Savings payment failed",
      failureBody: `KES ${amount.toLocaleString()} for ${savingsName} failed.`,
      link: "/personal-savings",
      type: "success",
    };
  }

  if (transaction.metadata?.chama_name || txType === "deposit" || txType === "contribution") {
    return {
      successTitle: "Chama deposit completed",
      successBody: `KES ${amount.toLocaleString()} has been processed for ${chamaName}.`,
      failureTitle: "Chama deposit failed",
      failureBody: `KES ${amount.toLocaleString()} for ${chamaName} failed.`,
      link: "/chamas",
      type: "success",
    };
  }

  return {
    successTitle: "Payment completed",
    successBody: `KES ${amount.toLocaleString()} payment completed successfully.`,
    failureTitle: "Payment failed",
    failureBody: `KES ${amount.toLocaleString()} payment failed.`,
    link: "/statement?accountType=all&accountName=All+Transactions",
    type: "info",
  };
}

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
    .select("id, status, metadata, user_id, type, description, amount, chama_id, savings_target_id")
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

    const copy = buildNotificationCopy(transaction);
    await insertNotification(
      supabase,
      transaction.user_id,
      copy.successTitle,
      copy.successBody,
      copy.type,
      copy.link,
    );
    await sendPush(
      supabase,
      transaction.user_id,
      copy.successTitle,
      copy.successBody,
    );
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

    const copy = buildNotificationCopy(transaction);
    const failureMessage = `${copy.failureBody} ${resultDesc}`.trim();
    await insertNotification(
      supabase,
      transaction.user_id,
      copy.failureTitle,
      failureMessage,
      "error",
      copy.link,
    );
    await sendPush(
      supabase,
      transaction.user_id,
      copy.failureTitle,
      failureMessage,
    );
  }

  return jsonResponse({ message: "Callback received" });
});
