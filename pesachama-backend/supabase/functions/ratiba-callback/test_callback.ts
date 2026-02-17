import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";

async function testCallback() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Create a dummy standing order to test against
    const { data: order, error: createError } = await supabase
        .from("standing_orders")
        .insert([{
            user_id: "00000000-0000-0000-0000-000000000000", // Update with a real user ID if possible
            chama_id: "00000000-0000-0000-0000-000000000000", // Update with a real chama ID if possible
            name: "Test Setup Callback",
            amount: 10.00,
            frequency: "4",
            start_date: "2024-12-21",
            end_date: "2024-12-22",
            status: "pending",
            mpesa_response_id: "test-ref-id-" + Date.now(),
        }])
        .select()
        .single();

    if (createError) {
        console.error("Error creating test order:", createError);
        return;
    }

    console.log(
        "Created test standing order with RefID:",
        order.mpesa_response_id,
    );

    // 2. Simulate Callback
    const callbackPayload = {
        "ResponseHeader": {
            "responseRefID": order.mpesa_response_id,
            "responseCode": "200",
            "responseDescription": "Request accepted for processing",
        },
        "ResponseBody": {
            "responseDescription": "Request accepted for processing",
            "responseCode": "200",
        },
    };

    const callbackUrl = `${SUPABASE_URL}/functions/v1/ratiba-callback`;
    console.log("Sending callback to:", callbackUrl);

    const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(callbackPayload),
    });

    const result = await response.json();
    console.log("Callback Result:", result);

    // 3. Verify Database
    const { data: updatedOrder, error: fetchError } = await supabase
        .from("standing_orders")
        .select("status, metadata")
        .eq("id", order.id)
        .single();

    if (fetchError) {
        console.error("Error fetching updated order:", fetchError);
    } else {
        console.log("Final Order Status:", updatedOrder.status);
        if (updatedOrder.status === "active") {
            console.log("✅ Verification Successful!");
        } else {
            console.log(
                "❌ Verification Failed: Status is",
                updatedOrder.status,
            );
        }
    }
}

testCallback();
