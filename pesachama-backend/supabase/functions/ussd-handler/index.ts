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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const phoneNumber = params.get("phoneNumber") || "";
    const text = params.get("text") || "";
    const sessionId = params.get("sessionId") || "";
    const serviceCode = params.get("serviceCode") || "";

    // Normalize phone number to 07... format for database lookup if needed
    // But usually database has it in international format or 07 format.
    // Let's assume database uses what was registered.
    // Ideally we should strip +254 or 254 to 0 for consistency if that's how it's stored.
    // For now, allow direct lookup.

    const levels = text.split("*");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let response = "";

    console.log(
      `USSD Session ${sessionId} - Phone: ${phoneNumber} - Text: ${text}`,
    );

    // Main Logic Flow
    if (text === "") {
      // Initial Menu
      response = "CON Welcome to Ratibu\n";
      response += "1. Check Balance\n";
      response += "2. Contribute\n";
      response += "3. Borrow\n";
      response += "4. Meeting Status\n";
      response += "5. My Account";
    } else if (levels[0] === "1") {
      // 1. Check Balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name")
        .eq("phone_number", phoneNumber)
        .single();

      if (profile) {
        // Calculate total contributions
        // For now, simple sum. In future, might be balance field in chama_members
        const { data: contributions } = await supabase
          .from("contributions")
          .select("amount")
          .eq("profile_id", profile.id)
          .eq("status", "completed");

        const total = contributions?.reduce((sum, c) =>
          sum + Number(c.amount), 0) || 0;

        response =
          `END Hello ${profile.first_name}, your total contributions: KES ${total.toLocaleString()}`;
      } else {
        response = "END Profile not found. Please register on the Ratibu App.";
      }
    } else if (levels[0] === "2") {
      // 2. Contribute
      if (levels.length === 1) {
        response = "CON Enter amount to contribute (KES):";
      } else {
        const amount = levels[1];

        // validate amount
        if (isNaN(Number(amount)) || Number(amount) <= 0) {
          response = "END Invalid amount. Please try again.";
        } else {
          // Find user and chama
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("phone_number", phoneNumber)
            .single();

          if (profile) {
            // Get primary chama for user
            const { data: member } = await supabase
              .from("chama_members")
              .select("chama_id")
              .eq("user_id", profile.id)
              .limit(1)
              .single();

            if (member) {
              // Trigger STK Push
              await fetch(`${SUPABASE_URL}/functions/v1/trigger-stk-push`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  amount: Number(amount),
                  phoneNumber: phoneNumber, // trigger-stk-push handles formatting
                  userId: profile.id,
                  chamaId: member.chama_id,
                }),
              });

              response =
                `END STK Push sent to ${phoneNumber}. Please enter your PIN to complete contribution of KES ${amount}.`;
            } else {
              response =
                "END You do not belong to any Chama. Please join one on the app.";
            }
          } else {
            response =
              "END Profile not found. Please register on the Ratibu App.";
          }
        }
      }
    } else if (levels[0] === "3") {
      // 3. Borrow
      response = "END Loan service coming soon!";
    } else if (levels[0] === "4") {
      // 4. Meeting Status
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phoneNumber)
        .single();

      if (profile) {
        const { data: member } = await supabase
          .from("chama_members")
          .select("chama_id")
          .eq("user_id", profile.id)
          .limit(1)
          .single();

        if (member) {
          const { data: meeting } = await supabase
            .from("meetings")
            .select("scheduled_at, agenda, video_link")
            .eq("group_id", member.chama_id) // "group_id" based on schema inspection
            .gte("scheduled_at", new Date().toISOString())
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .single();

          if (meeting) {
            const date = new Date(meeting.scheduled_at).toLocaleDateString();
            const time = new Date(meeting.scheduled_at).toLocaleTimeString();
            response = `END Next Meeting:\nDate: ${date} at ${time}\nAgenda: ${
              meeting.agenda || "General"
            }`;
          } else {
            response = "END No upcoming meetings scheduled.";
          }
        } else {
          response = "END You are not in a Chama.";
        }
      } else {
        response = "END Profile not found.";
      }
    } else if (levels[0] === "5") {
      // 5. My Account
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone_number")
        .eq("phone_number", phoneNumber)
        .single();

      if (profile) {
        response = `END Name: ${profile.first_name} ${
          profile.last_name || ""
        }\nPhone: ${profile.phone_number}`;
      } else {
        response = "END Account not found.";
      }
    } else {
      response = "END Invalid option selected.";
    }

    return new Response(response, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("USSD Error:", error);
    return new Response("END System error. Please try again later.", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
