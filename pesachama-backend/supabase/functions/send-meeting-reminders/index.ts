import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Reminder windows: how many minutes before the meeting to send each reminder
const REMINDER_WINDOWS = [
  { label: "24 hours",   minutesBefore: 1440, key: "24h"   },
  { label: "2 hours",    minutesBefore: 120,  key: "2h"    },
  { label: "30 minutes", minutesBefore: 30,   key: "30min" },
];

// ±7 min tolerance so a cron running every 15 min never misses a window
const TOLERANCE_MINUTES = 7;

async function sendEmail(to: string, subject: string, html: string) {
  const host = Deno.env.get("SMTP_HOST");
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM");
  if (!host || !user || !pass || !from) return;
  const client = new SmtpClient();
  try {
    await client.connectTLS({ hostname: host, port, username: user, password: pass });
    await client.send({ from, to, subject, content: "Please view in HTML client", html });
    await client.close();
  } catch (e) {
    console.error("SMTP error:", e);
  }
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
) {
  const { data: tokens } = await supabase
    .from("user_fcm_tokens")
    .select("token")
    .eq("user_id", userId);
  if (!tokens?.length) return;

  const fcmKey = Deno.env.get("FCM_SERVER_KEY");
  if (!fcmKey) return;

  for (const { token } of tokens) {
    try {
      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body, sound: "default" },
          priority: "high",
        }),
      });
    } catch (e) {
      console.error("FCM error:", e);
    }
  }
}

function buildEmailHtml(
  memberName: string,
  chamaName: string,
  title: string,
  date: Date,
  venue: string,
  videoLink: string | null,
  timeUntil: string,
) {
  const dateStr = date.toLocaleString("en-KE", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
  <div style="background:#00C853;padding:16px 24px;border-radius:8px;margin-bottom:24px;">
    <h1 style="color:white;margin:0;font-size:20px;">⏰ Meeting Reminder</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">Starts in <strong>${timeUntil}</strong></p>
  </div>
  <p style="color:#333;">Hi <strong>${memberName}</strong>,</p>
  <p style="color:#555;">Reminder for your upcoming chama meeting:</p>
  <div style="background:#f8f9fa;border-left:4px solid #00C853;padding:16px;border-radius:4px;margin:16px 0;">
    <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#111;">${title}</p>
    <p style="margin:0 0 4px;color:#555;font-size:14px;">📅 ${dateStr}</p>
    <p style="margin:0 0 4px;color:#555;font-size:14px;">👥 ${chamaName}</p>
    <p style="margin:0;color:#555;font-size:14px;">${videoLink
      ? `🎥 <a href="${videoLink}" style="color:#00C853;">Join Meeting</a>`
      : `📍 ${venue}`}</p>
  </div>
  ${videoLink
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${videoLink}" style="background:#00C853;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Join Now</a>
       </div>`
    : ""}
  <p style="color:#888;font-size:12px;margin-top:24px;">You're a member of <strong>${chamaName}</strong> on Ratibu.</p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const results: Record<string, number> = { "24h": 0, "2h": 0, "30min": 0 };

  try {
    for (const window of REMINDER_WINDOWS) {
      const target = new Date(now.getTime() + window.minutesBefore * 60_000);
      const from   = new Date(target.getTime() - TOLERANCE_MINUTES * 60_000);
      const to     = new Date(target.getTime() + TOLERANCE_MINUTES * 60_000);

      const { data: meetings } = await supabase
        .from("meetings")
        .select(`id, title, date, venue, video_link, chama_id,
                 chamas ( name ),
                 meeting_reminders_sent`)
        .gte("date", from.toISOString())
        .lte("date", to.toISOString());

      if (!meetings?.length) continue;

      for (const meeting of meetings) {
        const reminderKey = `${meeting.id}_${window.key}`;
        const sent = (meeting.meeting_reminders_sent as string[] | null) ?? [];
        if (sent.includes(reminderKey)) continue;

        const meetingDate = new Date(meeting.date);
        const chamaName  = (meeting.chamas as any)?.name ?? "Your Chama";
        const venue      = meeting.venue ?? "TBD";
        const videoLink  = meeting.video_link ?? null;

        const { data: members } = await supabase
          .from("chama_members")
          .select("user_id, users ( email, first_name, last_name )")
          .eq("chama_id", meeting.chama_id)
          .eq("status", "active");

        if (!members?.length) continue;

        for (const member of members) {
          const user = (member as any).users;
          if (!user?.email) continue;

          const memberName = user.first_name
            ? `${user.first_name} ${user.last_name ?? ""}`.trim()
            : "Member";

          // Email
          await sendEmail(
            user.email,
            `⏰ "${meeting.title}" starts in ${window.label}`,
            buildEmailHtml(memberName, chamaName, meeting.title,
              meetingDate, venue, videoLink, window.label),
          );

          // Push notification
          await sendPush(
            supabase, member.user_id,
            `Meeting in ${window.label}`,
            `"${meeting.title}" for ${chamaName} starts in ${window.label}.`,
          );

          // In-app notification inbox
          await supabase.from("notifications").insert({
            user_id: member.user_id,
            title: `Meeting in ${window.label}`,
            message: `"${meeting.title}" for ${chamaName} starts in ${window.label}.`,
            type: "info",
            is_read: false,
          });
        }

        // Mark reminder as sent
        await supabase
          .from("meetings")
          .update({ meeting_reminders_sent: [...sent, reminderKey] })
          .eq("id", meeting.id);

        results[window.key]++;
      }
    }

    return jsonResponse({ ok: true, reminders_sent: results });
  } catch (err: any) {
    console.error("send-meeting-reminders error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
