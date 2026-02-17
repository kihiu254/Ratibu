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
        console.log("B2C Callback Payload:", JSON.stringify(payload));

        const { Result } = payload;
        const {
            ResultCode,
            ResultDesc,
            OriginatorConversationID,
            TransactionID,
            ResultParameters,
        } = Result;

        // 1. Initialize Supabase Admin
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // 2. Find the payout record
        const { data: payout, error: findError } = await supabaseAdmin
            .from("payouts")
            .select("*")
            .eq("originator_conversation_id", OriginatorConversationID)
            .single();

        if (findError) {
            console.error("Payout not found for ID:", OriginatorConversationID);
            return new Response(JSON.stringify({ error: "Payout not found" }), {
                status: 404,
            });
        }

        // 3. Update Payout Status
        const status = ResultCode === 0 ? "completed" : "failed";
        const updateData: any = {
            status,
            result_code: ResultCode.toString(),
            result_desc: ResultDesc,
            updated_at: new Date().toISOString(),
            completed_at: status === "completed"
                ? new Date().toISOString()
                : null,
            transaction_id: TransactionID,
        };

        const { error: updateError } = await supabaseAdmin
            .from("payouts")
            .update(updateData)
            .eq("id", payout.id);

        if (updateError) throw updateError;

        // 4. Update Chama Balance if completed
        if (status === "completed") {
            await supabaseAdmin.rpc("decrement_chama_balance", {
                chama_id_param: payout.chama_id,
                amount_param: payout.amount,
            });

            // Also mark in transactions table for history visibility
            await supabaseAdmin
                .from("transactions")
                .insert({
                    chama_id: payout.chama_id,
                    user_id: payout.user_id,
                    amount: payout.amount,
                    type: "withdrawal",
                    status: "completed",
                    payment_method: "mpesa",
                    reference: TransactionID,
                    description: `Withdrawal to ${payout.phone_number}`,
                    metadata: { payout_id: payout.id },
                });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Callback Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
