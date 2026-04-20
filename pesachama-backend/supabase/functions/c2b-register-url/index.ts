import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postDarajaJson } from "../_shared/daraja.ts";

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

async function requireInternalAccess(authHeader: string | null) {
  const token = getBearerToken(authHeader);
  if (!token) {
    throw new Error("Missing bearer token");
  }

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return { source: "internal" as const };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized request");
  }

  return { source: "user" as const, userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    await requireInternalAccess(req.headers.get("Authorization"));
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Unauthorized" }, 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const raw = payload as Record<string, unknown>;
  const shortCode = String(raw.shortCode || raw.ShortCode || Deno.env.get("MPESA_C2B_SHORTCODE") || Deno.env.get("MPESA_BUSINESS_SHORTCODE") || "");
  const validationUrl = String(raw.validationUrl || raw.ValidationURL || "");
  const confirmationUrl = String(raw.confirmationUrl || raw.ConfirmationURL || "");
  const responseType = String(raw.responseType || raw.ResponseType || "Completed");
  const accessToken = typeof raw.accessToken === "string" ? raw.accessToken : null;

  if (!shortCode || !validationUrl || !confirmationUrl) {
    return jsonResponse({
      error: "Missing required fields: shortCode, validationUrl, confirmationUrl",
    }, 400);
  }

  try {
    const result = await postDarajaJson(
      "/mpesa/c2b/v2/registerurl",
      {
        ShortCode: shortCode,
        ResponseType: responseType === "Cancelled" ? "Cancelled" : "Completed",
        ConfirmationURL: confirmationUrl,
        ValidationURL: validationUrl,
      },
      accessToken,
    );

    return jsonResponse({
      success: true,
      data: result,
      shortCode,
      validationUrl,
      confirmationUrl,
      responseType: responseType === "Cancelled" ? "Cancelled" : "Completed",
    });
  } catch (error: any) {
    return jsonResponse({
      success: false,
      error: error.message || "C2B register URL request failed",
    }, 400);
  }
});
