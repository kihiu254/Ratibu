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
