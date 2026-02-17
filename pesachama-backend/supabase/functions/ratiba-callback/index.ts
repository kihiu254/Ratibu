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

interface CallbackItem {
    Name?: string;
    Value?: string | number | null;
    name?: string;
    value?: string | number | null;
}

interface RatibaCallbackPayload {
    ResponseHeader?: {
        responseCode?: string | number;
        responseDescription?: string;
        responseRefID?: string;
    };
    responseHeader?: {
        responseCode?: string | number;
        responseDescription?: string;
        responseRefID?: string;
    };
    ResponseBody?: {
        responseData?: CallbackItem[];
        ResponseData?: CallbackItem[];
    };
    responseBody?: {
        responseData?: CallbackItem[];
        ResponseData?: CallbackItem[];
    };
    ResultCode?: string | number;
    ResultDesc?: string;
    TransactionID?: string;
    [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload: RatibaCallbackPayload = await req.json();
        console.log("Received Ratiba Callback:", JSON.stringify(payload));

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const header = payload.ResponseHeader || payload.responseHeader;
        const body = payload.ResponseBody || payload.responseBody;

        const responseRefID = header?.responseRefID;

        // ResultCode can be in ResponseHeader or in ResponseData within ResponseBody
        let resultCode = payload.ResultCode || header?.responseCode ||
            body?.responseCode;
        let transactionId = payload.TransactionID;

        const responseData = body?.ResponseData || body?.responseData;
        if (Array.isArray(responseData)) {
            const resultCodeItem = responseData.find((i: CallbackItem) =>
                (i.Name || i.name) === "ResultCode" ||
                (i.Name || i.name) === "responseCode"
            );
            if (resultCodeItem) {
                resultCode = (resultCodeItem.Value ?? resultCodeItem.value ??
                    undefined) as string | number | undefined;
            }

            const transIdItem = responseData.find((i: CallbackItem) =>
                (i.Name || i.name) === "TransactionID"
            );
            if (transIdItem) {
                transactionId =
                    (transIdItem.Value ?? transIdItem.value ?? undefined) as
                        | string
                        | undefined;
            }
        }

        if (!responseRefID) {
            console.error(
                "Missing responseRefID in callback payload:",
                JSON.stringify(payload),
            );
            return new Response(
                JSON.stringify({ error: "Missing responseRefID" }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // 1. Find the standing order by mpesa_response_id
        const { data: standingOrder, error: fetchError } = await supabase
            .from("standing_orders")
            .select("id, name")
            .eq("mpesa_response_id", responseRefID)
            .single();

        if (fetchError || !standingOrder) {
            console.error("Standing order not found for RefID:", responseRefID);
            // We return 200 anyway to stop Safaricom from retrying, but log the error
            return new Response(
                JSON.stringify({
                    message: "Order not found, but callback received",
                }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // 2. Update status based on ResultCode
        // Safaricom ResultCode "0" or "200" is success for Ratiba
        const resultString = String(resultCode);
        const isSuccess = resultString === "0" || resultString === "200";
        const newStatus = isSuccess ? "active" : "failed";

        const { error: updateError } = await supabase
            .from("standing_orders")
            .update({
                status: newStatus,
                mpesa_transaction_id: (transactionId as string) || undefined,
                metadata: {
                    ...payload,
                    callback_received_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
            })
            .eq("id", standingOrder.id);

        if (updateError) {
            console.error(
                "Failed to update standing order status:",
                updateError,
            );
            throw updateError;
        }

        console.log(
            `Standing Order ${standingOrder.id} (${standingOrder.name}) updated to ${newStatus}. ResultCode: ${resultCode}`,
        );

        return new Response(
            JSON.stringify({
                message: "Callback processed successfully",
                status: newStatus,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Ratiba Callback Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
