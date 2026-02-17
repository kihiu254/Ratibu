import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { transactionId, originatorConversationId, partyA } = await req
            .json();

        // 1. Initialize Supabase Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // 2. Get M-Pesa Credentials
        const mpesaConsumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const mpesaConsumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const mpesaInitiatorName = Deno.env.get("MPESA_INITIATOR_NAME");
        const mpesaSecurityCredential = Deno.env.get(
            "MPESA_SECURITY_CREDENTIAL",
        );
        const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

        const baseUrl = mpesaEnv === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke";

        // 3. Generate Access Token
        const auth = btoa(`${mpesaConsumerKey}:${mpesaConsumerSecret}`);
        const tokenResponse = await fetch(
            `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: { Authorization: `Basic ${auth}` },
            },
        );
        const { access_token } = await tokenResponse.json();

        // 4. Call M-Pesa Transaction Status API
        const statusResponse = await fetch(
            `${baseUrl}/mpesa/transactionstatus/v1/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    Initiator: mpesaInitiatorName,
                    SecurityCredential: mpesaSecurityCredential,
                    CommandID: "TransactionStatusQuery",
                    TransactionID: transactionId,
                    OriginalConversationID: originatorConversationId,
                    PartyA: partyA,
                    IdentifierType: "4",
                    ResultURL: `${
                        Deno.env.get("SUPABASE_URL")
                    }/functions/v1/status-callback`,
                    QueueTimeOutURL: `${
                        Deno.env.get("SUPABASE_URL")
                    }/functions/v1/status-callback`,
                    Remarks: "Status Query",
                    Occasion: "Reconciliation",
                }),
            },
        );

        const statusData = await statusResponse.json();

        return new Response(
            JSON.stringify({ success: true, data: statusData }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
