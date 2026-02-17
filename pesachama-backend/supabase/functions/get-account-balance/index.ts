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
        const { shortCode, chamaId } = await req.json();

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

        // 4. Call M-Pesa Account Balance API
        const balanceResponse = await fetch(
            `${baseUrl}/mpesa/accountbalance/v1/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    Initiator: mpesaInitiatorName,
                    SecurityCredential: mpesaSecurityCredential,
                    CommandID: "AccountBalance",
                    PartyA: shortCode,
                    IdentifierType: "4",
                    Remarks: "Balance Query",
                    QueueTimeOutURL: `${
                        Deno.env.get("SUPABASE_URL")
                    }/functions/v1/balance-callback`,
                    ResultURL: `${
                        Deno.env.get("SUPABASE_URL")
                    }/functions/v1/balance-callback`,
                }),
            },
        );

        const balanceData = await balanceResponse.json();

        // Store the request metadata in balance_history if provided
        if (chamaId && balanceData.OriginatorConversationID) {
            await supabaseAdmin.from("balance_history").insert({
                chama_id: chamaId,
                originator_conversation_id:
                    balanceData.OriginatorConversationID,
                conversation_id: balanceData.ConversationID,
            });
        }

        return new Response(
            JSON.stringify({ success: true, data: balanceData }),
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
