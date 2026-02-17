import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { merchantName, refNo, amount, trxCode, cpi, size } = await req
            .json();

        const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

        if (!consumerKey || !consumerSecret) {
            throw new Error("Missing M-Pesa environment variables");
        }

        const baseUrl = mpesaEnv === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke";

        // 1. Get Access Token
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const authResp = await fetch(
            `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: { Authorization: `Basic ${auth}` },
            },
        );

        if (!authResp.ok) {
            const errorText = await authResp.text();
            throw new Error(`M-Pesa Auth Error: ${errorText}`);
        }

        const { access_token } = await authResp.json();

        // 2. Generate QR Code
        const qrPayload = {
            MerchantName: merchantName || "Ratibu Chama",
            RefNo: refNo || "Payment",
            Amount: Math.ceil(amount || 1),
            TrxCode: trxCode || "PB", // Default to Paybill
            CPI: cpi || Deno.env.get("MPESA_BUSINESS_SHORTCODE") || "174379",
            Size: size || "300",
        };

        const qrResp = await fetch(`${baseUrl}/mpesa/qrcode/v1/generate`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(qrPayload),
        });

        if (!qrResp.ok) {
            const errorText = await qrResp.text();
            throw new Error(`M-Pesa QR Error: ${errorText}`);
        }

        const qrData = await qrResp.json();

        return new Response(JSON.stringify(qrData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
