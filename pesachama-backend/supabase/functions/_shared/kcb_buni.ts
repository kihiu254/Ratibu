const DEFAULT_BASE_URL = "https://uat.buni.kcbgroup.com";
const DEFAULT_TOKEN_URL = "https://accounts.buni.kcbgroup.com/oauth2/token";

export type KcbBuniAction =
  | "validate-request"
  | "vendor-confirmation"
  | "transaction-status";

export type KcbBuniRequest = {
  action: KcbBuniAction;
  payload: Record<string, unknown>;
  accessToken?: string | null;
};

export function getKcbBuniConfig() {
  const baseUrl = Deno.env.get("KCB_BUNI_BASE_URL") || DEFAULT_BASE_URL;
  const tokenUrl = Deno.env.get("KCB_BUNI_TOKEN_URL") || DEFAULT_TOKEN_URL;
  const accessToken = Deno.env.get("KCB_BUNI_ACCESS_TOKEN") || "";
  const consumerKey = Deno.env.get("KCB_BUNI_CONSUMER_KEY") || "";
  const consumerSecret = Deno.env.get("KCB_BUNI_CONSUMER_SECRET") || "";

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    tokenUrl,
    accessToken,
    consumerKey,
    consumerSecret,
  };
}

export function resolveKcbBuniPath(action: KcbBuniAction) {
  switch (action) {
    case "validate-request":
      return "/api/validate-request";
    case "vendor-confirmation":
      return "/api/vendor-confirmation";
    case "transaction-status":
      return "/api/query/transaction-status";
  }
}

export async function invokeKcbBuniGateway(
  action: KcbBuniAction,
  payload: Record<string, unknown>,
  accessToken?: string | null,
) {
  const { baseUrl, tokenUrl, accessToken: envToken, consumerKey, consumerSecret } = getKcbBuniConfig();
  let token = accessToken?.trim() || envToken.trim();

  if (!token) {
    if (!consumerKey || !consumerSecret) {
      throw new Error(
        "Missing KCB Buni credentials. Set KCB_BUNI_ACCESS_TOKEN or KCB_BUNI_CONSUMER_KEY and KCB_BUNI_CONSUMER_SECRET.",
      );
    }

    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch(`${tokenUrl}?grant_type=client_credentials`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    const tokenData = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok) {
      const message = typeof tokenData === "string"
        ? tokenData
        : (tokenData as Record<string, unknown> | null)?.error_description?.toString() ||
          (tokenData as Record<string, unknown> | null)?.error?.toString() ||
          `KCB token request failed with status ${tokenResponse.status}`;
      throw new Error(message);
    }

    token = (tokenData as Record<string, unknown> | null)?.access_token?.toString() || "";
    if (!token) {
      throw new Error("KCB token response did not include access_token.");
    }
  }

  const response = await fetch(`${baseUrl}${resolveKcbBuniPath(action)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Access-Control-Allow-Origin": "*",
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
      : (data as Record<string, unknown> | null)?.message?.toString() ||
        (data as Record<string, unknown> | null)?.error?.toString() ||
        `KCB Buni request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function buildKcbValidationRequest(args: {
  conversationId: string;
  serviceCode: string;
  serviceName: string;
  channelName: string;
  timeStamp: string;
  partnerId: string;
  partnerUserId: string;
  callBackURL: string;
  billerCode: string;
  billReference: string;
  transactionReference: string;
}) {
  return {
    header: {
      conversationID: args.conversationId,
      serviceCode: args.serviceCode,
      serviceName: args.serviceName,
      channelName: args.channelName,
      timeStamp: args.timeStamp,
      partnerId: args.partnerId,
      partnerUserId: args.partnerUserId,
      callBackURL: args.callBackURL,
    },
    requestPayload: {
      billerData: {
        billerCode: args.billerCode,
      },
      transactionInfo: {
        billerRef: args.billReference,
        transactionReference: args.transactionReference,
      },
    },
  };
}

export function buildKcbConfirmationRequest(args: {
  conversationId: string;
  serviceCode: string;
  serviceName: string;
  channelName: string;
  timeStamp: string;
  partnerId: string;
  partnerUserId: string;
  callBackURL: string;
  billerCode: string;
  transactionAmount: string;
  chargeFees: string;
  transactionReference: string;
  billReference: string;
  narration: string;
  phoneNumber: string;
}) {
  return {
    header: {
      conversationID: args.conversationId,
      serviceCode: args.serviceCode,
      serviceName: args.serviceName,
      channelName: args.channelName,
      timeStamp: args.timeStamp,
      partnerId: args.partnerId,
      partnerUserId: args.partnerUserId,
      callBackURL: args.callBackURL,
    },
    requestPayload: {
      billerData: {
        billerCode: args.billerCode,
      },
      transactionInfo: {
        transactionAmount: args.transactionAmount,
        chargeFees: args.chargeFees,
        transactionReference: args.transactionReference,
        billReference: args.billReference,
        narration: args.narration,
        phoneNumber: args.phoneNumber,
      },
    },
  };
}

export function buildKcbTransactionStatusRequest(args: {
  originatorRequestId: string;
}) {
  return {
    payload: {
      originatorRequestId: args.originatorRequestId,
    },
  };
}
