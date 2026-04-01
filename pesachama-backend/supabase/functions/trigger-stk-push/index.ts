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

const normalizePhoneNumber = (value: string) => {
  const trimmed = value.replace(/\s+/g, "");
  if (/^2547\d{8}$/.test(trimmed)) return trimmed;
  if (/^07\d{8}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  if (/^\+2547\d{8}$/.test(trimmed)) return trimmed.slice(1);
  return null;
};

const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

async function authenticateRequest(
  supabase: ReturnType<typeof createClient>,
  authHeader: string | null,
  userId: string,
) {
  const token = getBearerToken(authHeader);

  if (!token) {
    throw new Error("Missing bearer token");
  }

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { source: "internal" as const };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Unauthorized request");
  }

  if (data.user.id !== userId) {
    throw new Error("Authenticated user does not match requested userId");
  }

  return { source: "user" as const, userId: data.user.id };
}

Deno.serve(async (req) => {
  console.log(`${req.method} request to trigger-stk-push`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const payload = await req.json().catch(() => null);

  if (!payload) {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const { amount, phoneNumber, userId, chamaId, requestId, type } = payload;

  if (!amount || !phoneNumber || !userId || !chamaId) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return jsonResponse({ error: "Amount must be a positive number" }, 400);
  }

  const formattedPhone = normalizePhoneNumber(String(phoneNumber));
  if (!formattedPhone) {
    return jsonResponse(
      { error: "Phone number must be in 07XXXXXXXX or 2547XXXXXXXX format" },
      400,
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let transactionId: string | null = null;

  try {
    await authenticateRequest(supabase, authHeader, String(userId));

    if (requestId) {
      const { data: existingTransaction, error: existingError } = await supabase
        .from("transactions")
        .select("id, status, metadata")
        .eq("user_id", userId)
        .eq("chama_id", chamaId)
        .eq("metadata->>payment_request_id", String(requestId))
        .in("status", ["pending", "completed"])
        .maybeSingle();

      if (existingError) {
        console.error("Failed checking existing transaction:", existingError);
      }

      const existingCheckoutId = existingTransaction?.metadata
        ?.checkout_request_id;

      if (existingTransaction && (existingTransaction.status === "completed" ||
        existingCheckoutId)) {
        return jsonResponse({
          message: existingTransaction.status === "completed"
            ? "Payment already completed for this request"
            : "STK push already initiated for this request",
          transactionId: existingTransaction.id,
          checkoutRequestId: existingCheckoutId ?? null,
          deduplicated: true,
        });
      }
    }

    const { data: transaction, error: dbError } = await supabase
      .from("transactions")
      .insert([
        {
          amount: numericAmount,
          user_id: userId,
          chama_id: chamaId,
          type: type || "deposit",
          status: "pending",
          payment_method: "mpesa",
          description: type === "contribution"
            ? "Contribution Payment"
            : "M-Pesa Deposit",
          metadata: {
            ...(requestId ? { payment_request_id: requestId } : {}),
            phone_number: formattedPhone,
            initiated_at: new Date().toISOString(),
          },
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error("DB Error:", dbError);
      return jsonResponse({ error: dbError.message }, 500);
    }

    transactionId = transaction.id;

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const shortcode = Deno.env.get("MPESA_BUSINESS_SHORTCODE");
    const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      throw new Error("Missing M-Pesa environment variables");
    }

    const baseUrl = mpesaEnv === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const authResp = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
      },
    );

    if (!authResp.ok) {
      const errorText = await authResp.text();
      throw new Error(`Auth Failed: ${authResp.status} ${errorText}`);
    }

    const { access_token } = await authResp.json();

    const date = new Date();
    const timestamp = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0") +
      date.getHours().toString().padStart(2, "0") +
      date.getMinutes().toString().padStart(2, "0") +
      date.getSeconds().toString().padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(numericAmount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: "Ratibu",
      TransactionDesc: "Chama Deposit",
    };

    const stkResp = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      },
    );

    const contentType = stkResp.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await stkResp.text();
      throw new Error(`M-Pesa Non-JSON Response: ${text}`);
    }

    const stkData = await stkResp.json();
    if (stkData.ResponseCode && stkData.ResponseCode !== "0") {
      throw new Error(
        stkData.errorMessage ||
          `STK Push Failed: ${stkData.ResponseCode} - ${
            stkData.ResponseDescription || ""
          }`,
      );
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        metadata: {
          ...(transaction.metadata || {}),
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
        },
      })
      .eq("id", transaction.id);

    if (updateError) {
      console.error("Failed to update transaction metadata:", updateError);
    }

    return jsonResponse({
      message: "STK Push Initiated",
      transactionId: transaction.id,
      checkoutRequestId: stkData.CheckoutRequestID,
      merchantRequestId: stkData.MerchantRequestID,
    });
  } catch (err: any) {
    console.error("STK Push Critical Error:", err);

    if (transactionId) {
      await supabase
        .from("transactions")
        .update({
          status: "failed",
          description: `Failed: ${err.message || "Unknown Error"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);
    }

    return jsonResponse(
      {
        error: err.message || "Unknown Error",
        details: err.toString(),
      },
      400,
    );
  }
});
