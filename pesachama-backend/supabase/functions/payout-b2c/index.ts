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
        const { amount, phoneNumber, userId, chamaId, remarks, occasion } =
            await req.json();

        // 1. Initialize Supabase Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // 2. Get M-Pesa Credentials
        const mpesaConsumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const mpesaConsumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const mpesaShortCode = Deno.env.get("MPESA_B2C_SHORTCODE") ||
            Deno.env.get("MPESA_BUSINESS_SHORTCODE");
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

        // 4. Generate OriginatorConversationID
        const originatorConversationId = `B2C_${Date.now()}_${
            Math.floor(Math.random() * 1000)
        }`;

        // 5. Create Payout Record
        const { data: payout, error: payoutError } = await supabaseAdmin
            .from("payouts")
            .insert({
                chama_id: chamaId,
                user_id: userId,
                amount,
                phone_number: phoneNumber,
                status: "initiated",
                originator_conversation_id: originatorConversationId,
                remarks: remarks || "Chama Withdrawal",
            })
            .select()
            .single();

        if (payoutError) throw payoutError;

        // 6. Call M-Pesa B2C API
        const b2cResponse = await fetch(
            `${baseUrl}/mpesa/b2c/v3/paymentrequest`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    OriginatorConversationID: originatorConversationId,
                    InitiatorName: mpesaInitiatorName,
                    SecurityCredential: mpesaSecurityCredential,
                    CommandID: "BusinessPayment",
                    Amount: amount,
                    PartyA: mpesaShortCode,
                    PartyB: phoneNumber,
                    Remarks: remarks || "Chama Withdrawal",
                    QueueTimeOutURL: `${
                        Deno.env.get("SUPABASE_URL")
                    }/functions/v1/b2c-callback`,
                    ResultURL: `${
                        Deno.env.get("SUPABASE_URL")
                    }/functions/v1/b2c-callback`,
                    Occassion: occasion || "Withdrawal",
                }),
            },
        );

        const b2cData = await b2cResponse.json();

        if (b2cData.ResponseCode === "0") {
            // Update with ConversationID
            await supabaseAdmin
                .from("payouts")
                .update({ conversation_id: b2cData.ConversationID })
                .eq("id", payout.id);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Payout initiated successfully",
                    data: b2cData,
                }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        } else {
            // Update as failed
            await supabaseAdmin
                .from("payouts")
                .update({
                    status: "failed",
                    result_desc: b2cData.ResponseDescription,
                })
                .eq("id", payout.id);

            return new Response(
                JSON.stringify({
                    success: false,
                    error: b2cData.ResponseDescription || "M-Pesa API Error",
                }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
