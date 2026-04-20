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
        const payload = await req.json();
        console.log("Status Callback Payload:", JSON.stringify(payload));

        if (payload && typeof payload === "object" && "requestId" in payload) {
            const {
                requestId,
                resultCode,
                resultDesc,
                transactionId,
                amount,
                paymentReference,
                status,
            } = payload as Record<string, unknown>;

            const supabaseAdmin = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            );

            const requestReference = String(requestId || "");
            const paymentStatus = String(status || "").toUpperCase();
            const completed = String(resultCode || "") === "0" || paymentStatus === "SUCCESS";

            const { data: event } = await supabaseAdmin
                .from("mpesa_payment_events")
                .select("*")
                .eq("request_reference", requestReference)
                .maybeSingle();

            if (event) {
                await supabaseAdmin.from("mpesa_payment_events").update({
                    status: completed ? "completed" : "failed",
                    transaction_id: transactionId ? String(transactionId) : event.transaction_id,
                    result_code: String(resultCode || ""),
                    result_desc: String(resultDesc || ""),
                    raw_callback: payload,
                    completed_at: completed ? new Date().toISOString() : event.completed_at,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...(event.metadata ?? {}),
                        payment_reference: paymentReference ?? null,
                        callback_status: status ?? null,
                        processed_at: new Date().toISOString(),
                    },
                }).eq("id", event.id);

                if (completed && event.user_id) {
                    const { data: existingTransaction } = await supabaseAdmin
                        .from("transactions")
                        .select("id")
                        .eq("reference", transactionId ? String(transactionId) : requestReference)
                        .maybeSingle();

                    if (existingTransaction) {
                        return new Response(JSON.stringify({ success: true, duplicated: true }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }

                    const { error: transactionInsertError } = await supabaseAdmin.from("transactions").insert({
                        chama_id: event.chama_id || null,
                        user_id: event.user_id,
                        amount: event.amount,
                        type: "deposit",
                        status: "completed",
                        payment_method: "mpesa",
                        reference: transactionId ? String(transactionId) : requestReference,
                        mpesa_transaction_id: transactionId ? String(transactionId) : null,
                        description: `B2B payment to ${event.partner_name || "merchant"}`,
                        metadata: {
                            payment_event_id: event.id,
                            request_reference: requestReference,
                            payment_reference: paymentReference ?? null,
                            source: "status-callback",
                            raw_callback: payload,
                        },
                    });
                    if (transactionInsertError) {
                        console.error("Failed to insert B2B transaction history:", transactionInsertError);
                    }
                }
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { Result } = payload;
        const {
            ResultCode,
            ResultDesc,
            OriginatorConversationID,
            ResultParameters,
        } = Result;

        // 1. Initialize Supabase Admin
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // Logic: If status is 'Completed', find corresponding record in transactions or payouts and update it.
        // ResultParameters contains TransactionStatus: "Completed" etc.
        const statusParam = ResultParameters?.ResultParameter?.find((p: any) =>
            p.Key === "TransactionStatus"
        );
        const mpesaStatus = statusParam?.Value || "";

        if (mpesaStatus === "Completed" || mpesaStatus === "Success") {
            // Query both tables to see which one this belongs to
            // (Implementation can be more specific based on naming of OriginatorConversationID)

            if (OriginatorConversationID.startsWith("B2C_")) {
                await supabaseAdmin.from("payouts").update({
                    status: "completed",
                }).eq("originator_conversation_id", OriginatorConversationID);
            } else {
                // Likely an STK push or C2B
                await supabaseAdmin.from("transactions").update({
                    status: "completed",
                }).eq("reference", OriginatorConversationID);
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
