const DEFAULT_MPESA_BASE_URL = "https://sandbox.safaricom.co.ke";

export type MpesaEnvironment = "sandbox" | "production";

export function getMpesaEnvironment(): MpesaEnvironment {
  const value = (Deno.env.get("MPESA_ENV") || "sandbox").toLowerCase();
  return value === "production" ? "production" : "sandbox";
}

export function getMpesaBaseUrl() {
  return getMpesaEnvironment() === "production"
    ? "https://api.safaricom.co.ke"
    : DEFAULT_MPESA_BASE_URL;
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join("");
}

export function normalizeMpesaPhoneNumber(value: string): string | null {
  const trimmed = value.replace(/[\s\-()]/g, "");
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  return null;
}

export async function getMpesaAccessToken() {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET.");
  }

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  const response = await fetch(
    `${getMpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data === "string"
      ? data
      : (data as Record<string, unknown> | null)?.error_description?.toString() ||
        (data as Record<string, unknown> | null)?.error?.toString() ||
        `Unable to generate M-Pesa access token (${response.status})`;
    throw new Error(message);
  }

  const accessToken = (data as Record<string, unknown> | null)?.access_token?.toString() || "";
  if (!accessToken) {
    throw new Error("M-Pesa token response did not include access_token.");
  }

  return accessToken;
}

export async function postDarajaJson(
  path: string,
  payload: Record<string, unknown>,
  accessToken?: string | null,
) {
  const token = accessToken?.trim() || await getMpesaAccessToken();

  const response = await fetch(`${getMpesaBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message = typeof data === "string"
      ? data
      : (data as Record<string, unknown> | null)?.ResponseDescription?.toString() ||
        (data as Record<string, unknown> | null)?.error?.toString() ||
        (data as Record<string, unknown> | null)?.message?.toString() ||
        `Daraja request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}
