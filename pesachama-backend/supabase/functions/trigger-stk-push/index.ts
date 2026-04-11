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

const failureResponse = (message: string, status = 400, details?: string) =>
  jsonResponse({
    error: message,
    ...(details ? { details } : {}),
  }, status);

// Accepts: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, 2541XXXXXXXX, +254XXXXXXXXX
const normalizePhoneNumber = (value: string): string | null => {
  const trimmed = value.replace(/[\s\-()]/g, "");
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  return null;
};

const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

async function authenticateRequest(
  supabase: any,
  authHeader: string | null,
  userId: string,
) {
  const token = getBearerToken(authHeader);
  if (!token) throw new Error("Missing bearer token");
  if (token === SUPABASE_SERVICE_ROLE_KEY) return { source: "internal" as const };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized request");
  if (data.user.id !== userId) throw new Error("Authenticated user does not match requested userId");

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

  const {
    amount,
    phoneNumber,
    userId,
    chamaId,
    savingsTargetId,
    destinationType,
    mshwariPhone,
    requestId,
    type,
  } = payload;

  const isMshwari = destinationType === "mshwari";

  // Validate required fields
  if (!amount || !phoneNumber || !userId) {
    return jsonResponse({ error: "Missing required fields: amount, phoneNumber, userId" }, 400);
  }
  if (!isMshwari && !chamaId && !savingsTargetId) {
    return jsonResponse({ error: "Provide chamaId, savingsTargetId, or destinationType: mshwari" }, 400);
  }
  if (isMshwari && !mshwariPhone) {
    return failureResponse("Mshwari phone is required for this deposit.");
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return jsonResponse({ error: "Amount must be a positive number" }, 400);
  }

  const formattedPhone = normalizePhoneNumber(String(phoneNumber));
  if (!formattedPhone) {
    return failureResponse("Invalid phone number. Use 07XXXXXXXX, 01XXXXXXXX, or 254XXXXXXXXX format.");
  }

  const normalizedMshwariPhone = isMshwari ? normalizePhoneNumber(String(mshwariPhone)) : null;
  if (isMshwari && !normalizedMshwariPhone) {
    return failureResponse("Invalid Mshwari phone number format.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let transactionId: string | null = null;

  try {
    await authenticateRequest(supabase, authHeader, String(userId));

    // Deduplication check
    if (requestId) {
      let existingQuery = supabase
        .from("transactions")
        .select("id, status, metadata")
        .eq("user_id", userId)
        .eq("metadata->>payment_request_id", String(requestId))
        .in("status", ["pending", "completed"]);

      if (chamaId) existingQuery = existingQuery.eq("chama_id", chamaId);
      if (savingsTargetId) existingQuery = existingQuery.eq("savings_target_id", savingsTargetId);

      const { data: existingTx } = await existingQuery.maybeSingle();
      const existingCheckoutId = existingTx?.metadata?.checkout_request_id;

      if (existingTx && (existingTx.status === "completed" || existingCheckoutId)) {
        return jsonResponse({
          message: existingTx.status === "completed"
            ? "Payment already completed for this request"
            : "STK push already initiated for this request",
          transactionId: existingTx.id,
          checkoutRequestId: existingCheckoutId ?? null,
          deduplicated: true,
        });
      }
    }

    // Insert transaction record
    const txType = isMshwari ? "mshwari_deposit" : (type || "deposit");
    const txDescription = isMshwari
      ? "Mshwari Savings Deposit"
      : savingsTargetId
        ? "Savings Deposit"
        : type === "contribution"
          ? "Contribution Payment"
          : "M-Pesa Deposit";

    const { data: transaction, error: dbError } = await supabase
      .from("transactions")
      .insert([{
        amount: numericAmount,
        user_id: userId,
        ...(chamaId ? { chama_id: chamaId } : {}),
        ...(savingsTargetId ? { savings_target_id: savingsTargetId } : {}),
        type: txType,
        status: "pending",
        payment_method: "mpesa",
        description: txDescription,
        metadata: {
          ...(requestId ? { payment_request_id: requestId } : {}),
          phone_number: formattedPhone,
          ...(isMshwari ? { mshwari_phone: normalizedMshwariPhone, destination: "mshwari" } : {}),
          initiated_at: new Date().toISOString(),
        },
      }])
      .select()
      .single();

    if (dbError) {
      console.error("DB Error:", dbError);
      return jsonResponse({ error: dbError.message }, 500);
    }

    transactionId = transaction.id;

    // M-Pesa credentials
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const shortcode = Deno.env.get("MPESA_BUSINESS_SHORTCODE");
    const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      throw new Error("Missing M-Pesa environment variables. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, and MPESA_BUSINESS_SHORTCODE.");
    }

    if (isMshwari && mpesaEnv !== "production") {
      return failureResponse(
        "Mshwari deposits require production M-Pesa credentials. Sandbox does not trigger a real Mshwari prompt.",
        400,
        "MPESA_ENV is sandbox",
      );
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
      throw new Error(`Unable to authenticate with M-Pesa (${authResp.status}). ${errorText}`);
    }

    const { access_token } = await authResp.json();

    const date = new Date();
    const timestamp = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0") +
      date.getHours().toString().padStart(2, "0") +
      date.getMinutes().toString().padStart(2, "0") +
      date.getSeconds().toString().padStart(2, "0");

    // Mshwari uses paybill 512400; account reference = user's Mshwari phone number
    const targetShortcode = isMshwari ? "512400" : shortcode;
    const targetPasskey = isMshwari
      ? (Deno.env.get("MPESA_MSHWARI_PASSKEY") || passkey)
      : passkey;
    const password = btoa(`${targetShortcode}${targetPasskey}${timestamp}`);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: targetShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(numericAmount),
      PartyA: formattedPhone,
      PartyB: targetShortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: isMshwari ? normalizedMshwariPhone! : "Ratibu",
      TransactionDesc: isMshwari ? "Mshwari Savings" : "Chama Deposit",
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
      const responseDescription = stkData.ResponseDescription || "";
      const errorMessage = stkData.errorMessage || "";
      const friendlyMessage =
        isMshwari && mpesaEnv !== "production"
          ? "Mshwari deposits do not work in sandbox."
          : stkData.ResponseCode === "1032"
            ? "Payment cancelled on the phone."
            : stkData.ResponseCode === "2001"
              ? "M-Pesa could not process the request right now. Try again."
              : stkData.ResponseCode === "1037"
                ? "The STK prompt timed out. Try again."
                : errorMessage || responseDescription || `STK Push failed with code ${stkData.ResponseCode}`;

      throw new Error(friendlyMessage);
    }

    await supabase
      .from("transactions")
      .update({
        metadata: {
          ...(transaction.metadata || {}),
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
        },
      })
      .eq("id", transaction.id);

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

    return failureResponse(err.message || "Unknown Error", 400, err.toString());
  }
});
