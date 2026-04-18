import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildKcbConfirmationRequest,
  buildKcbTransactionStatusRequest,
  buildKcbValidationRequest,
  invokeKcbBuniGateway,
  type KcbBuniAction,
} from "../_shared/kcb_buni.ts";

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

function normalizeAction(action: unknown): KcbBuniAction {
  const value = String(action || "").trim();
  if (value === "validate-request" || value === "vendor-confirmation" || value === "transaction-status") {
    return value;
  }
  throw new Error("Invalid action. Use validate-request, vendor-confirmation, or transaction-status.");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join("");
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
  const requestPayload = (raw.requestPayload as Record<string, unknown> | undefined) ?? {};
  const nestedTransactionInfo = (requestPayload.transactionInfo as Record<string, unknown> | undefined) ?? {};
  const nestedBillerData = (requestPayload.billerData as Record<string, unknown> | undefined) ?? {};
  const action = normalizeAction(raw.action);
  const accessToken = typeof (payload as Record<string, unknown>).accessToken === "string"
    ? String((payload as Record<string, unknown>).accessToken)
    : null;

  const buildRequest = () => {
    const conversationId = String(raw.conversationID || raw.conversationId || crypto.randomUUID());
    const serviceCode = String(raw.serviceCode || "8001");
    const serviceName = String(raw.serviceName || (action === "validate-request" ? "Validation" : action === "vendor-confirmation" ? "Confirmation" : "Status"));
    const channelName = String(raw.channelName || "ws02");
    const timeStamp = String(raw.timeStamp || raw.timestamp || formatTimestamp());
    const partnerId = String(raw.partnerId || "006");
    const partnerUserId = String(raw.partnerUserId || "006");
    const callBackURL = String(raw.callBackURL || raw.callbackUrl || "");

    if (action === "validate-request") {
      return buildKcbValidationRequest({
        conversationId,
        serviceCode,
        serviceName,
        channelName,
        timeStamp,
        partnerId,
        partnerUserId,
        callBackURL,
        billerCode: String(raw.billerCode || nestedBillerData.billerCode || "10"),
        billReference: String(raw.billReference || raw.billerRef || nestedTransactionInfo.billerRef || ""),
        transactionReference: String(raw.transactionReference || raw.originatorRequestId || nestedTransactionInfo.transactionReference || conversationId),
      });
    }

    if (action === "vendor-confirmation") {
      return buildKcbConfirmationRequest({
        conversationId,
        serviceCode,
        serviceName,
        channelName,
        timeStamp,
        partnerId,
        partnerUserId,
        callBackURL,
        billerCode: String(raw.billerCode || nestedBillerData.billerCode || "99"),
        transactionAmount: String(raw.transactionAmount || raw.amount || nestedTransactionInfo.transactionAmount || "0"),
        chargeFees: String(raw.chargeFees || nestedTransactionInfo.chargeFees || "0"),
        transactionReference: String(raw.transactionReference || nestedTransactionInfo.transactionReference || conversationId),
        billReference: String(raw.billReference || nestedTransactionInfo.billReference || ""),
        narration: String(raw.narration || nestedTransactionInfo.narration || "token purchase"),
        phoneNumber: String(raw.phoneNumber || nestedTransactionInfo.phoneNumber || ""),
      });
    }

    return buildKcbTransactionStatusRequest({
      originatorRequestId: String(raw.originatorRequestId || (raw.payload as Record<string, unknown> | undefined)?.originatorRequestId || conversationId),
    });
  };

  try {
    const result = await invokeKcbBuniGateway(action, buildRequest(), accessToken);
    return jsonResponse({
      success: true,
      action,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message || "KCB Buni request failed";
    const configMissing = message.toLowerCase().includes("missing kcb buni credentials");
    return jsonResponse({
      success: false,
      action,
      error: message,
      code: configMissing ? "KCB_BUNI_NOT_CONFIGURED" : "KCB_BUNI_REQUEST_FAILED",
      configurable: configMissing,
    }, configMissing ? 503 : 400);
  }
});
