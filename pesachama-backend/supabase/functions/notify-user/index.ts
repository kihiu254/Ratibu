import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { sendFirebasePush } from "../_shared/firebase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

async function sendEmail(to: string, subject: string, html: string, body?: string) {
  const host = Deno.env.get("SMTP_HOST");
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM");
  if (!host || !user || !pass || !from) return;

  const client = new SmtpClient();
  try {
    await client.connectTLS({ hostname: host, port, username: user, password: pass });
    await client.send({
      from,
      to,
      subject,
      content: body || "Please view this email in an HTML-compatible client",
      html,
    });
  } finally {
    try {
      await client.close();
    } catch {
      // ignore local SMTP teardown errors
    }
  }
}

async function resolveCallerRole(supabase: any, token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("system_role, email, first_name, last_name")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    role: String(profile?.system_role ?? "user"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 500);
  }

  const token = getBearerToken(req.headers.get("Authorization"));
  if (!token) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const targetUserId = String(payload.targetUserId || "").trim();
  const title = String(payload.title || "").trim();
  const message = String(payload.message || "").trim();
  const type = String(payload.type || "info").trim();
  const link = payload.link ? String(payload.link).trim() : null;
  const emailSubject = payload.emailSubject ? String(payload.emailSubject).trim() : title;
  const emailHtml = payload.emailHtml ? String(payload.emailHtml) : `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
      <h2 style="color:#00C853;">${title}</h2>
      <p>${message}</p>
      ${link ? `<p><a href="${link}" style="color:#00C853;">Open in Ratibu</a></p>` : ""}
    </div>
  `;

  if (!targetUserId || !title || !message) {
    return jsonResponse({
      error: "targetUserId, title, and message are required",
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const caller = await resolveCallerRole(supabase, token);
  if (targetUserId !== caller.id && caller.role !== "admin" && caller.role !== "super_admin") {
    return jsonResponse({ error: "Admin access required to notify another member" }, 403);
  }

  const { data: recipient, error: userError } = await supabase
    .from("users")
    .select("email, first_name, last_name")
    .eq("id", targetUserId)
    .maybeSingle();

  if (userError) {
    return jsonResponse({ error: userError.message }, 500);
  }

  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: targetUserId,
    title,
    message,
    type,
    is_read: false,
    link,
  });

  if (notificationError) {
    console.error("Failed to insert notification:", notificationError);
  }

  if (recipient?.email) {
    try {
      await sendEmail(recipient.email, emailSubject, emailHtml, message);
    } catch (e) {
      console.error("Email notification failed:", e);
    }
  }

  try {
    const { data: tokens } = await supabase
      .from("user_fcm_tokens")
      .select("token")
      .eq("user_id", targetUserId);

    for (const row of tokens ?? []) {
      await sendFirebasePush(row.token, title, message, link ? { link } : undefined);
    }
  } catch (e) {
    console.error("Push notification failed:", e);
  }

  return jsonResponse({
    success: true,
    notifiedUserId: targetUserId,
  });
});
