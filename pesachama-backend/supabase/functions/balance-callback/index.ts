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
        console.log("Balance Callback Payload:", JSON.stringify(payload));

        const { Result } = payload;
        const { ResultCode, OriginatorConversationID, ResultParameters } =
            Result;

        if (ResultCode !== 0) {
            console.error("Balance query failed:", Result.ResultDesc);
            return new Response("ok");
        }

        // 1. Initialize Supabase Admin
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // 2. Parse Balances
        const balanceParam = ResultParameters.ResultParameter.find((p: any) =>
            p.Key === "AccountBalance"
        );
        // Sample Value: "Working Account|KES|700000.00|700000.00|0.00|0.00&Float Account|KES|0.00|0.00|0.00|0.00&Utility Account|KES|228037.00|228037.00|0.00|0.00&Charges Paid Account|KES|-1540.00|-1540.00|0.00|0.00&Organization Settlement Account|KES|0.00|0.00|0.00|0.00"

        const balanceString = balanceParam?.Value || "";
        const accounts = balanceString.split("&");

        const balances: any = {};
        accounts.forEach((acc: string) => {
            const parts = acc.split("|");
            const name = parts[0];
            const availableBalance = parseFloat(parts[2]);
            if (name.includes("Working")) balances.working = availableBalance;
            if (name.includes("Utility")) balances.utility = availableBalance;
            if (name.includes("Charges Paid")) {
                balances.charges = availableBalance;
            }
        });

        // 3. Update Balance History
        await supabaseAdmin
            .from("balance_history")
            .update({
                working_balance: balances.working,
                utility_balance: balances.utility,
                charges_paid_balance: balances.charges,
            })
            .eq("originator_conversation_id", OriginatorConversationID);

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Balance Callback Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
