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

interface StandingOrderRequest {
    amount: number;
    phoneNumber: string;
    userId: string;
    chamaId: string;
    standingOrderName: string;
    startDate: string;
    endDate: string;
    frequency: string | number;
}

interface RatibaResponse {
    ResponseHeader: {
        responseCode: string;
        responseDescription: string;
        responseRefID: string;
    };
    [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const {
            amount,
            phoneNumber,
            userId,
            chamaId,
            standingOrderName,
            startDate,
            endDate,
            frequency,
        }: StandingOrderRequest = await req.json();

        if (
            !amount || !phoneNumber || !userId || !chamaId ||
            !standingOrderName || !startDate || !endDate || !frequency
        ) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Create a pending standing order record
        const { data: standingOrder, error: dbError } = await supabase
            .from("standing_orders")
            .insert([
                {
                    user_id: userId,
                    chama_id: chamaId,
                    name: standingOrderName,
                    amount,
                    frequency: frequency.toString(),
                    start_date: startDate,
                    end_date: endDate,
                    status: "pending",
                },
            ])
            .select()
            .single();

        if (dbError) {
            throw dbError;
        }

        // 2. Safaricom Ratiba Integration
        const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
        const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
        const shortcode = Deno.env.get("MPESA_BUSINESS_SHORTCODE");
        const mpesaEnv = Deno.env.get("MPESA_ENV") || "sandbox";

        const baseUrl = mpesaEnv === "production"
            ? "https://api.safaricom.co.ke"
            : "https://sandbox.safaricom.co.ke";

        // Get Access Token
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const authResp = await fetch(
            `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: { Authorization: `Basic ${auth}` },
            },
        );
        const { access_token } = await authResp.json();

        // Prepare Ratiba Payload
        const formattedPhone = phoneNumber.startsWith("0")
            ? `254${phoneNumber.slice(1)}`
            : phoneNumber.replace("+", "");

        const callbackUrl = `${SUPABASE_URL}/functions/v1/ratiba-callback`;

        const ratibaPayload = {
            StandingOrderName: standingOrderName,
            StartDate: startDate.replace(/-/g, ""), // Convert YYYY-MM-DD to YYYYMMDD
            EndDate: endDate.replace(/-/g, ""),
            BusinessShortCode: shortcode,
            TransactionType: "Standing Order Customer Pay Bill",
            ReceiverPartyIdentifierType: "4",
            Amount: Math.ceil(Number(amount)).toString(),
            PartyA: formattedPhone,
            CallBackURL: callbackUrl,
            AccountReference: `RSO-${standingOrder.id.slice(0, 8)}`,
            TransactionDesc: "ChamaPayment",
            Frequency: frequency.toString(),
        };

        console.log("Sending Ratiba Payload:", JSON.stringify(ratibaPayload));

        const ratibaResp = await fetch(
            `${baseUrl}/standingorder/v1/createStandingOrderExternal`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(ratibaPayload),
            },
        );

        const ratibaData: RatibaResponse = await ratibaResp.json();
        console.log("Ratiba Response:", ratibaData);

        if (ratibaData.ResponseHeader?.responseCode !== "200") {
            throw new Error(
                ratibaData.ResponseHeader?.responseDescription ||
                    "Ratiba Request Failed",
            );
        }

        // Update record with response reference
        await supabase
            .from("standing_orders")
            .update({
                mpesa_response_id: ratibaData.ResponseHeader.responseRefID,
                metadata: { ...ratibaData },
            })
            .eq("id", standingOrder.id);

        return new Response(
            JSON.stringify({
                message: "Standing Order Request Initiated",
                responseRefID: ratibaData.ResponseHeader.responseRefID,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Ratiba Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
