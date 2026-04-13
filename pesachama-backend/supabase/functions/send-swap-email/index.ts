import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFirebasePush } from "../_shared/firebase.ts";

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
  requester_id: string | null;
  target_user_id: string | null;
  requester: { id?: string; email?: string; first_name?: string; last_name?: string } | null;
  target: { id?: string; email?: string; first_name?: string; last_name?: string } | null;
  chama: { name?: string } | null;
};

type Recipient = {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
};

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

function displayName(user: Recipient | null, fallback: string) {
  const name = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  return name || fallback;
}

function buildNotification(event: SwapEvent, swap: SwapRow) {
  const chamaName = swap.chama?.name || "your chama";
  const requesterName = displayName(swap.requester, "A member");
  const targetName = displayName(swap.target, "A member");
  const period = new Date(`${swap.month}T00:00:00`).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });

  if (event === "request_created") {
    return {
      title: `New swap request in ${chamaName}`,
      message: `${requesterName} requested a swap for ${period}.`,
      recipients: swap.target ? [swap.target] : [],
      emailSubject: `New swap request in ${chamaName}`,
      emailHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <h2 style="color: #00C853; margin-top: 0;">New allocation swap request</h2>
          <p>${requesterName} requested to swap allocation days with you in <strong>${chamaName}</strong>.</p>
          <p><strong>Month:</strong> ${period}</p>
          <p><strong>Your current day:</strong> Day ${swap.target_day}</p>
          <p><strong>Requested day:</strong> Day ${swap.requester_day}</p>
          <p>Open Ratibu to approve or reject the request.</p>
        </div>`,
    };
  }

  if (event === "approved") {
    return {
      title: `Swap approved in ${chamaName}`,
      message: `${targetName} approved the swap request for ${period}.`,
      recipients: [swap.requester, swap.target].filter(Boolean) as Recipient[],
      emailSubject: `Swap approved in ${chamaName}`,
      emailHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
          <h2 style="color: #00C853; margin-top: 0;">Swap approved</h2>
          <p>The swap request in <strong>${chamaName}</strong> was approved.</p>
          <p><strong>Month:</strong> ${period}</p>
          <p>Allocation days have been updated.</p>
        </div>`,
    };
  }

  return {
    title: `Swap declined in ${chamaName}`,
    message: `${targetName} declined the swap request for ${period}.`,
    recipients: [swap.requester, swap.target].filter(Boolean) as Recipient[],
    emailSubject: `Swap request declined in ${chamaName}`,
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
        <h2 style="color: #ef4444; margin-top: 0;">Swap declined</h2>
        <p>The swap request in <strong>${chamaName}</strong> was declined.</p>
        <p><strong>Month:</strong> ${period}</p>
        <p>Your allocation remains unchanged.</p>
      </div>`,
  };
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
        requester:users!allocation_swap_requests_requester_id_fkey(id, email, first_name, last_name),
        target:users!allocation_swap_requests_target_user_id_fkey(id, email, first_name, last_name),
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

    const notification = buildNotification(event, data as unknown as SwapRow);
    const recipients = notification.recipients.filter((recipient) => recipient?.id);

    for (const recipient of recipients) {
      const targetId = String(recipient.id);
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: targetId,
        title: notification.title,
        message: notification.message,
        type: event === "approved" ? "success" : event === "rejected" ? "warning" : "info",
        is_read: false,
        link: `/swaps`,
      });
      if (notificationError) {
        console.error("Failed to insert swap notification:", notificationError);
      }

      if (recipient.email) {
        await sendMail(recipient.email, notification.emailSubject, notification.emailHtml);
      }

      const { data: tokens } = await supabase
        .from("user_fcm_tokens")
        .select("token")
        .eq("user_id", targetId);

      for (const row of tokens ?? []) {
        await sendFirebasePush(row.token, notification.title, notification.message, { link: `/swaps` });
      }
    }

    return new Response(JSON.stringify({ message: "Swap notifications sent", sent: recipients.length }), {
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
