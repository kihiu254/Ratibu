import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, body, html } = await req.json();

    if (!to || !subject || (!body && !html)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, and (body or html)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Attempting to send email to ${to} with subject: ${subject}`);
    const host = Deno.env.get("SMTP_HOST");
    const port = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    const from = Deno.env.get("SMTP_FROM");

    if (!host || !user || !pass || !from) {
      console.error("Missing SMTP Config:", { host: !!host, user: !!user, pass: !!pass, from: !!from });
      throw new Error("Missing SMTP environment variables");
    }

    const client = new SmtpClient();

    try {
      console.log(`Connecting to ${host}:${port} via TLS...`);
      await client.connectTLS({
        hostname: host,
        port: port,
        username: user,
        password: pass,
      });
      console.log("SMTP Connection established");

      await client.send({
        from: from,
        to: to,
        subject: subject,
        content: body || (html ? "Please view this email in an HTML-compatible client" : "No content provided"),
        html: html,
      });
      console.log("Email content accepted by server");

      await client.close();
      console.log("SMTP Connection closed");

      return new Response(
        JSON.stringify({ message: "Email sent successfully" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (smtpErr: any) {
      console.error("Internal SMTP Error:", smtpErr);
      throw smtpErr;
    }
  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
