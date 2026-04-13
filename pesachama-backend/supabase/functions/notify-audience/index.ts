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

async function resolveCaller(supabase: any, token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return { id: data.user.id };
}

async function getRecipients(supabase: any, audience: string, callerId: string, chamaId?: string) {
  if (audience === "admins") {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, first_name, last_name")
      .in("system_role", ["admin", "super_admin"]);
    if (error) throw error;
    return (data ?? []).filter((row: any) => row.id !== callerId);
  }

  if (audience === "chama_members") {
    if (!chamaId) {
      throw new Error("chamaId is required for chama_members audience");
    }

    const { data, error } = await supabase
      .from("chama_members")
      .select("user_id, users(id, email, first_name, last_name)")
      .eq("chama_id", chamaId)
      .eq("status", "active");
    if (error) throw error;

    const seen = new Set<string>();
    return (data ?? [])
      .map((row: any) => row.users)
      .filter((user: any) => {
        if (!user?.id || user.id === callerId || seen.has(user.id)) return false;
        seen.add(user.id);
        return true;
      });
  }

  if (audience === "chama_admins") {
    if (!chamaId) {
      throw new Error("chamaId is required for chama_admins audience");
    }

    const { data, error } = await supabase
      .from("chama_members")
      .select("user_id, users(id, email, first_name, last_name)")
      .eq("chama_id", chamaId)
      .eq("status", "active")
      .in("role", ["admin", "treasurer", "secretary"]);
    if (error) throw error;

    const seen = new Set<string>();
    return (data ?? [])
      .map((row: any) => row.users)
      .filter((user: any) => {
        if (!user?.id || user.id === callerId || seen.has(user.id)) return false;
        seen.add(user.id);
        return true;
      });
  }

  throw new Error(`Unsupported audience: ${audience}`);
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

  const audience = String(payload.audience || "").trim();
  const title = String(payload.title || "").trim();
  const message = String(payload.message || "").trim();
  const type = String(payload.type || "info").trim();
  const link = payload.link ? String(payload.link).trim() : null;
  const chamaId = payload.chamaId ? String(payload.chamaId).trim() : undefined;
  const emailSubject = payload.emailSubject ? String(payload.emailSubject).trim() : title;
  const emailHtml = payload.emailHtml ? String(payload.emailHtml) : `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
      <h2 style="color:#00C853;">${title}</h2>
      <p>${message}</p>
      ${link ? `<p><a href="${link}" style="color:#00C853;">Open in Ratibu</a></p>` : ""}
    </div>
  `;

  if (!audience || !title || !message) {
    return jsonResponse({
      error: "audience, title, and message are required",
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const caller = await resolveCaller(supabase, token);
  const recipients = await getRecipients(supabase, audience, caller.id, chamaId);

  let notified = 0;
  for (const recipient of recipients) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: recipient.id,
      title,
      message,
      type,
      is_read: false,
      link,
    });
    if (notificationError) {
      console.error("Failed to insert notification:", notificationError);
    }

    if (recipient.email) {
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
        .eq("user_id", recipient.id);

      for (const row of tokens ?? []) {
        await sendFirebasePush(row.token, title, message, link ? { link } : undefined);
      }
    } catch (e) {
      console.error("Push notification failed:", e);
    }

    notified += 1;
  }

  return jsonResponse({
    success: true,
    audience,
    notifiedCount: notified,
  });
});
