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
  console.log(`${req.method} request to trigger-stk-push`);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Debug: Log headers to check for Authorization
  const authHeader = req.headers.get("Authorization");
  console.log("Request Headers:", Object.fromEntries(req.headers.entries()));
  console.log("Has Auth Header:", !!authHeader);

  try {
    const { amount, phoneNumber, userId, chamaId, requestId, type } = await req
      .json();

    if (!amount || !phoneNumber || !userId || !chamaId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Create a pending transaction record
    const { data: transaction, error: dbError } = await supabase
      .from("transactions")
      .insert([
        {
          amount,
          user_id: userId,
          chama_id: chamaId,
          type: type || "deposit",
          status: "pending",
          payment_method: "mpesa",
          description: type === "contribution"
            ? "Contribution Payment"
            : "M-Pesa Deposit",
          metadata: requestId ? { payment_request_id: requestId } : {},
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error("DB Error:", dbError);
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Trigger M-Pesa STK Push (Real)
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const shortcode = Deno.env.get("MPESA_BUSINESS_SHORTCODE");
    const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      console.error("Missing M-Pesa Env Vars:", {
        hasConsumerKey: !!consumerKey,
        hasConsumerSecret: !!consumerSecret,
        hasPasskey: !!passkey,
        hasShortcode: !!shortcode,
      });
      throw new Error("Missing M-Pesa environment variables");
    }

    const baseUrl = mpesaEnv === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    // A. Get Access Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    console.log("Authenticating with M-Pesa...");
    const authResp = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
      },
    );

    if (!authResp.ok) {
      const errorText = await authResp.text();
      console.error("M-Pesa Auth Error:", errorText);
      throw new Error(`Auth Failed: ${authResp.status} ${errorText}`);
    }

    const { access_token } = await authResp.json();
    console.log("Auth successful.");

    // B. Generate Password & Timestamp
    const date = new Date();
    const timestamp = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0") +
      date.getHours().toString().padStart(2, "0") +
      date.getMinutes().toString().padStart(2, "0") +
      date.getSeconds().toString().padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // C. Send STK Push Request
    // Ensure phone number is in 2547... format
    const formattedPhone = phoneNumber.startsWith("0")
      ? `254${phoneNumber.slice(1)}`
      : phoneNumber;

    const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: "Ratibu", // Limited chars
      TransactionDesc: "Chama Deposit",
    };

    console.log("Sending STK Push Payload:", JSON.stringify(stkPayload));

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

    // Check if response is JSON
    const contentType = stkResp.headers.get("content-type");
    let stkData;
    if (contentType && contentType.includes("application/json")) {
      stkData = await stkResp.json();
    } else {
      const text = await stkResp.text();
      console.error("M-Pesa Raw Response:", text); // Log raw text for debugging
      throw new Error(`M-Pesa Non-JSON Response: ${text}`);
    }

    console.log("STK Push Response:", JSON.stringify(stkData)); // Log full JSON

    // Safaricom Sandbox sometimes returns ResponseCode 0 even if it fails later,
    // but usually non-zero is an immediate error.
    if (stkData.ResponseCode && stkData.ResponseCode !== "0") {
      throw new Error(
        stkData.errorMessage ||
          `STK Push Failed: ${stkData.ResponseCode} - ${
            stkData.ResponseDescription || ""
          }`,
      );
    }

    // Update transaction with checkout request ID
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
      console.error("Failed to update transaction:", updateError);
      // Don't throw here, prioritize returning success to user
    }

    return new Response(
      JSON.stringify({
        message: "STK Push Initiated",
        checkoutRequestId: stkData.CheckoutRequestID,
        merchantRequestId: stkData.MerchantRequestID,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("STK Push Critical Error:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Unknown Error",
        details: err.toString(), // Send full error string
      }),
      {
        status: 400, // Return 400 so client knows it's a logic/upstream error, not server crash
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
