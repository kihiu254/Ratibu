import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("SMTP_PASS");
const EMAIL_FROM = Deno.env.get("SMTP_FROM");

type SwapEvent = "request_created" | "approved" | "rejected";

type SwapRow = {
  id: string;
  month: string;
  requester_day: number;
  target_day: number;
  requester: { email?: string; first_name?: string; last_name?: string } | null;
  target: { email?: string; first_name?: string; last_name?: string } | null;
  chama: { name?: string } | null;
};

function fullName(user: { first_name?: string; last_name?: string } | null, fallback: string) {
  const name = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  return name || fallback;
}

function monthLabel(month: string) {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

async function sendMail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error("Missing email secrets (SMTP_PASS for API key or SMTP_FROM for sender).");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Ratibu Chama <${EMAIL_FROM}>`,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Resend API Error:", data);
    throw new Error(`Email service error: ${data.message || "Unknown error"}`);
  }
}

function buildMessages(event: SwapEvent, swap: SwapRow) {
  const chamaName = swap.chama?.name || "your chama";
  const requesterName = fullName(swap.requester, "A member");
  const targetName = fullName(swap.target, "A member");
  const period = monthLabel(swap.month);

  switch (event) {
    case "request_created":
      return swap.target?.email
        ? [{
            to: swap.target.email,
            subject: `New swap request in ${chamaName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                <h2 style="color: #00C853; margin-top: 0;">New allocation swap request</h2>
                <p>${requesterName} requested to swap allocation days with you in <strong>${chamaName}</strong>.</p>
                <p><strong>Month:</strong> ${period}</p>
                <p><strong>Your current day:</strong> Day ${swap.target_day}</p>
                <p><strong>Requested day:</strong> Day ${swap.requester_day}</p>
                <p>Open Ratibu to approve or reject the request.</p>
              </div>`,
          }]
        : [];
    case "approved":
      return [
        swap.requester?.email
          ? {
              to: swap.requester.email,
              subject: `Swap approved in ${chamaName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                  <h2 style="color: #00C853; margin-top: 0;">Swap approved</h2>
                  <p>${targetName} approved your swap request in <strong>${chamaName}</strong>.</p>
                  <p><strong>Month:</strong> ${period}</p>
                  <p>Your allocation has moved from Day ${swap.requester_day} to Day ${swap.target_day}.</p>
                </div>`,
            }
          : null,
        swap.target?.email
          ? {
              to: swap.target.email,
              subject: `Swap confirmed in ${chamaName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                  <h2 style="color: #00C853; margin-top: 0;">Swap confirmed</h2>
                  <p>You approved ${requesterName}'s swap request in <strong>${chamaName}</strong>.</p>
                  <p><strong>Month:</strong> ${period}</p>
                  <p>Your allocation has moved from Day ${swap.target_day} to Day ${swap.requester_day}.</p>
                </div>`,
            }
          : null,
      ].filter(Boolean) as Array<{ to: string; subject: string; html: string }>;
    case "rejected":
      return [
        swap.requester?.email
          ? {
              to: swap.requester.email,
              subject: `Swap request declined in ${chamaName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                  <h2 style="color: #ef4444; margin-top: 0;">Swap declined</h2>
                  <p>${targetName} declined your swap request in <strong>${chamaName}</strong>.</p>
                  <p><strong>Month:</strong> ${period}</p>
                  <p>Your allocation stays on Day ${swap.requester_day}.</p>
                </div>`,
            }
          : null,
        swap.target?.email
          ? {
              to: swap.target.email,
              subject: `You declined a swap request in ${chamaName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                  <h2 style="color: #f59e0b; margin-top: 0;">Swap declined</h2>
                  <p>You declined ${requesterName}'s swap request in <strong>${chamaName}</strong>.</p>
                  <p><strong>Month:</strong> ${period}</p>
                  <p>Your allocation stays on Day ${swap.target_day}.</p>
                </div>`,
            }
          : null,
      ].filter(Boolean) as Array<{ to: string; subject: string; html: string }>;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const { swapId, event } = await req.json() as { swapId?: string; event?: SwapEvent };

    if (!swapId || !event) {
      return new Response(JSON.stringify({ error: "Missing required fields: swapId and event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from("allocation_swap_requests")
      .select(`
        id,
        month,
        requester_day,
        target_day,
        requester:users!allocation_swap_requests_requester_id_fkey(email, first_name, last_name),
        target:users!allocation_swap_requests_target_user_id_fkey(email, first_name, last_name),
        chama:chamas(name)
      `)
      .eq("id", swapId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ error: "Swap request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = buildMessages(event, data as unknown as SwapRow);
    for (const message of messages) {
      await sendMail(message.to, message.subject, message.html);
    }

    return new Response(JSON.stringify({ message: "Swap email notifications sent", sent: messages.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-swap-email error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
