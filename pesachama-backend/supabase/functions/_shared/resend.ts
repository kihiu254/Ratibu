type SendResendEmailInput = {
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  text?: string;
  from?: string;
};

function normalizeFrom(from: string) {
  if (from.includes("<") && from.includes(">")) {
    return from;
  }
  return `Ratibu Chama <${from}>`;
}

export async function sendResendEmail(input: SendResendEmailInput) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("SMTP_PASS");
  const from = input.from || Deno.env.get("RESEND_FROM") || Deno.env.get("SMTP_FROM");

  if (!apiKey || !from) {
    throw new Error("Missing Resend configuration (RESEND_API_KEY/SMTP_PASS and RESEND_FROM/SMTP_FROM)");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: normalizeFrom(from),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text || input.body || "Please view this email in an HTML-compatible client.",
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Resend API error: ${data.message || data.error || "Unknown error"}`);
  }

  return data;
}
