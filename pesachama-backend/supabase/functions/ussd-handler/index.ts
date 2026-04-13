import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Accepts: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, 2541XXXXXXXX, +254XXXXXXXXX
const normalizePhoneNumber = (value: string): string | null => {
  const trimmed = value.replace(/[\s\-()]/g, "");
  if (/^254\d{9}$/.test(trimmed)) return trimmed;
  if (/^\+254\d{9}$/.test(trimmed)) return trimmed.slice(1);
  if (/^0\d{9}$/.test(trimmed)) return `254${trimmed.slice(1)}`;
  return null;
};

const getPhoneLookupValues = (value: string) => {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s\-()]/g, "");
  const variants = new Set<string>([trimmed, compact]);

  const normalized = normalizePhoneNumber(compact) ?? normalizePhoneNumber(trimmed);
  const digitsOnly = compact.replace(/[^\d]/g, "");

  if (normalized) {
    variants.add(normalized);
    variants.add(`+${normalized}`);
    variants.add(`0${normalized.slice(3)}`);
  }

  if (digitsOnly.startsWith("254") && digitsOnly.length === 12) {
    variants.add(digitsOnly);
    variants.add(`+${digitsOnly}`);
    variants.add(`0${digitsOnly.slice(3)}`);
  }

  if (digitsOnly.startsWith("0") && digitsOnly.length === 10) {
    const normalizedDigits = `254${digitsOnly.slice(1)}`;
    variants.add(normalizedDigits);
    variants.add(`+${normalizedDigits}`);
    variants.add(digitsOnly);
  }

  if (trimmed.startsWith("+")) {
    variants.add(trimmed.slice(1));
  }

  return Array.from(variants).filter(Boolean);
};

const normalizeForComparison = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(/^tel:/i, "").replace(/^whatsapp:/i, "");
  const compact = withoutPrefix.replace(/[\s\-()]/g, "");
  const digits = compact.replace(/[^\d]/g, "");

  if (digits.startsWith("254") && digits.length >= 12) {
    return `254${digits.slice(-9)}`;
  }

  if (digits.startsWith("0") && digits.length >= 10) {
    return `254${digits.slice(-9)}`;
  }

  if (digits.length === 9) {
    return `254${digits}`;
  }

  if (compact.startsWith("+254") && digits.length >= 12) {
    return `254${digits.slice(-9)}`;
  }

  return digits || compact.toLowerCase();
};

const buildPhoneComparisonSet = (phoneValues: string[]) => {
  const variants = new Set<string>();
  for (const value of phoneValues) {
    const normalized = normalizeForComparison(value);
    if (!normalized) continue;

    variants.add(normalized);
    variants.add(`+${normalized}`);
    variants.add(`0${normalized.slice(3)}`);
  }
  return variants;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

type UserLookupRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  mshwari_phone?: string | null;
  transaction_pin_hash?: string | null;
  transaction_pin_salt?: string | null;
  transaction_pin_enabled?: boolean | null;
  transaction_pin_failed_attempts?: number | null;
  transaction_pin_locked_until?: string | null;
};

type AuthUserLookupRecord = {
  id: string;
  phone?: string | null;
  raw_user_meta_data?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    phone?: string | null;
  } | null;
};

const buildDisplayName = (user: UserLookupRecord | null) => {
  const parts = [user?.first_name?.trim(), user?.last_name?.trim()].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return user?.full_name?.trim() || "Edwin";
};

const mergeUserRecord = (
  primary: UserLookupRecord | null,
  fallback: UserLookupRecord | null,
): UserLookupRecord | null => {
  if (!primary && !fallback) return null;
  return {
    id: primary?.id ?? fallback?.id ?? "",
    first_name: primary?.first_name ?? fallback?.first_name ?? null,
    last_name: primary?.last_name ?? fallback?.last_name ?? null,
    full_name: primary?.full_name ?? fallback?.full_name ?? null,
    phone: primary?.phone ?? fallback?.phone ?? null,
    phone_number: primary?.phone_number ?? fallback?.phone_number ?? null,
    mshwari_phone: primary?.mshwari_phone ?? fallback?.mshwari_phone ?? null,
    transaction_pin_hash: primary?.transaction_pin_hash ?? fallback?.transaction_pin_hash ?? null,
    transaction_pin_salt: primary?.transaction_pin_salt ?? fallback?.transaction_pin_salt ?? null,
    transaction_pin_enabled:
      primary?.transaction_pin_enabled ?? fallback?.transaction_pin_enabled ?? null,
    transaction_pin_failed_attempts:
      primary?.transaction_pin_failed_attempts ?? fallback?.transaction_pin_failed_attempts ?? null,
    transaction_pin_locked_until:
      primary?.transaction_pin_locked_until ?? fallback?.transaction_pin_locked_until ?? null,
  };
};

async function queryByPhone(
  supabase: any,
  table: string,
  phoneColumn: string,
  phoneValues: string[],
  select: string,
) : Promise<{ data: any; error: any }> {
  if (phoneValues.length === 0) {
    return { data: null, error: null };
  }

  const query = supabase.from(table).select(select);
  if (phoneValues.length === 1) {
    return await query.eq(phoneColumn, phoneValues[0]).maybeSingle();
  }
  return await query.in(phoneColumn, phoneValues).maybeSingle();
}

function matchesPhone(value: string | null | undefined, phoneSet: Set<string>) {
  const normalized = normalizeForComparison(value);
  if (!normalized) return false;
  return phoneSet.has(normalized) || phoneSet.has(`+${normalized}`) || phoneSet.has(`0${normalized.slice(3)}`);
}

async function findUserByPhone(
  supabase: any,
  phoneValues: string[],
) : Promise<UserLookupRecord | null> {
  const phoneSet = buildPhoneComparisonSet(phoneValues);
  const lookups = [
    {
      table: "users",
      phoneColumn: "phone",
      select:
        "id, first_name, last_name, phone, mshwari_phone, transaction_pin_hash, transaction_pin_salt, transaction_pin_enabled, transaction_pin_failed_attempts, transaction_pin_locked_until",
    },
    {
      table: "profiles",
      phoneColumn: "phone_number",
      select: "id, first_name, last_name, full_name, phone_number",
    },
  ];

  for (const lookup of lookups) {
    const { data, error } = await queryByPhone(
      supabase,
      lookup.table,
      lookup.phoneColumn,
      phoneValues,
      lookup.select,
    );

    if (!error && data) {
      return data as UserLookupRecord;
    }
  }

  const [usersScan, profilesScan, authScan] = await Promise.all([
    supabase
      .from("users")
      .select("id, first_name, last_name, phone, mshwari_phone, transaction_pin_hash, transaction_pin_salt, transaction_pin_enabled, transaction_pin_failed_attempts, transaction_pin_locked_until")
      .not("phone", "is", null),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, phone_number")
      .not("phone_number", "is", null),
    supabase
      .schema("auth")
      .from("users")
      .select("id, phone, raw_user_meta_data"),
  ]);

  if (!usersScan.error && Array.isArray(usersScan.data)) {
    const match = usersScan.data.find((row: UserLookupRecord) => matchesPhone(row.phone, phoneSet));
    if (match) return match;
  }

  if (!profilesScan.error && Array.isArray(profilesScan.data)) {
    const match = profilesScan.data.find((row: UserLookupRecord) => matchesPhone(row.phone_number, phoneSet));
    if (match) return match;
  }

  if (!authScan.error && Array.isArray(authScan.data)) {
    const authMatch = authScan.data.find((row: AuthUserLookupRecord) =>
      matchesPhone(row.phone, phoneSet) || matchesPhone(row.raw_user_meta_data?.phone, phoneSet)
    ) as AuthUserLookupRecord | undefined;

    if (authMatch) {
      const [publicUserResult, profileResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, first_name, last_name, phone, mshwari_phone, transaction_pin_hash, transaction_pin_salt, transaction_pin_enabled, transaction_pin_failed_attempts, transaction_pin_locked_until")
          .eq("id", authMatch.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, full_name, phone_number")
          .eq("id", authMatch.id)
          .maybeSingle(),
      ]);

      const publicUser = !publicUserResult.error ? publicUserResult.data as UserLookupRecord | null : null;
      const profileUser = !profileResult.error ? profileResult.data as UserLookupRecord | null : null;
      const authMetadata = authMatch.raw_user_meta_data ?? {};

      return mergeUserRecord(
        publicUser ?? {
          id: authMatch.id,
          first_name: authMetadata.first_name ?? null,
          last_name: authMetadata.last_name ?? null,
          full_name: authMetadata.full_name ?? null,
          phone: authMatch.phone ?? authMetadata.phone ?? null,
          phone_number: authMatch.phone ?? authMetadata.phone ?? null,
        },
        profileUser,
      );
    }
  }

  // Some older records only exist in auth.users with the phone stored in metadata.
  const authQuery = supabase
    .schema("auth")
    .from("users")
    .select("id, phone, raw_user_meta_data");
  const { data: authData, error: authError } = phoneValues.length === 1
    ? await authQuery.eq("phone", phoneValues[0]).maybeSingle()
    : await authQuery.in("phone", phoneValues).maybeSingle();

  if (!authError && authData) {
    const authUser = authData as AuthUserLookupRecord;
    const [publicUserResult, profileResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, first_name, last_name, phone, mshwari_phone, transaction_pin_hash, transaction_pin_salt, transaction_pin_enabled, transaction_pin_failed_attempts, transaction_pin_locked_until")
          .eq("id", authUser.id)
          .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name, phone_number")
        .eq("id", authUser.id)
        .maybeSingle(),
    ]);

    const publicUser = !publicUserResult.error ? publicUserResult.data as UserLookupRecord | null : null;
    const profileUser = !profileResult.error ? profileResult.data as UserLookupRecord | null : null;
    const authMetadata = authUser.raw_user_meta_data ?? {};

    return mergeUserRecord(
      publicUser ?? {
        id: authUser.id,
        first_name: authMetadata.first_name ?? null,
        last_name: authMetadata.last_name ?? null,
        full_name: authMetadata.full_name ?? null,
        phone: authUser.phone ?? authMetadata.phone ?? null,
        phone_number: authUser.phone ?? authMetadata.phone ?? null,
      },
      profileUser,
    );
  }

  return null;
}

type PinVerificationResult =
  | { success: true }
  | { success: false; needsSetup: true; resetRequired?: false }
  | { success: false; needsSetup: false; resetRequired: true }
  | { success: false; needsSetup: false; resetRequired: false; attemptsRemaining: number };

const maxPinAttempts = 3;

function getAttemptsRemaining(failedAttempts: number | null | undefined) {
  const attempts = Number(failedAttempts ?? 0);
  return Math.max(0, maxPinAttempts - attempts);
}

function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

function splitFullName(fullName: string | null | undefined) {
  const name = (fullName ?? "").trim();
  if (!name) return { first_name: "", last_name: "" };
  const parts = name.split(/\s+/);
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  };
}

async function verifyTransactionPin(
  supabase: any,
  user: UserLookupRecord,
  pin: string,
): Promise<PinVerificationResult> {
  if (!isValidPin(pin)) {
    return { success: false, needsSetup: false, resetRequired: false, attemptsRemaining: 0 };
  }

  const hasPin = Boolean(user.transaction_pin_hash && user.transaction_pin_salt);
  const failedAttempts = Number(user.transaction_pin_failed_attempts ?? 0);
  const resetRequired = hasPin && (!user.transaction_pin_enabled || failedAttempts >= maxPinAttempts);

  if (!hasPin) {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = bytesToHex(saltBytes);
    const pinHash = await hashPin(pin, salt);

    const { error } = await supabase
      .from("users")
      .update({
        transaction_pin_hash: pinHash,
        transaction_pin_salt: salt,
        transaction_pin_enabled: true,
        transaction_pin_failed_attempts: 0,
        transaction_pin_locked_until: null,
        transaction_pin_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return { success: false, needsSetup: false, resetRequired: false, attemptsRemaining: 0 };
    }

    await logUssdAudit(supabase, {
      userId: user.id,
      action: "ussd_pin_created",
      resourceType: "transaction_pin",
      newValue: { channel: "ussd" },
    });

    return { success: true };
  }

  if (resetRequired) {
    await logUssdAudit(supabase, {
      userId: user.id,
      action: "ussd_pin_locked",
      resourceType: "transaction_pin",
      newValue: {
        channel: "ussd",
        failed_attempts: failedAttempts,
      },
    });
    return { success: false, needsSetup: false, resetRequired: true };
  }

  const pinHash = await hashPin(pin, user.transaction_pin_salt!);
  if (pinHash !== user.transaction_pin_hash) {
    const nextAttempts = failedAttempts + 1;
    const lockRequired = nextAttempts >= maxPinAttempts;

    await supabase
      .from("users")
      .update({
        transaction_pin_failed_attempts: nextAttempts,
        transaction_pin_enabled: lockRequired ? false : true,
        transaction_pin_locked_until: lockRequired ? null : user.transaction_pin_locked_until ?? null,
      })
      .eq("id", user.id);

    await logUssdAudit(supabase, {
      userId: user.id,
      action: lockRequired ? "ussd_pin_locked" : "ussd_pin_failed",
      resourceType: "transaction_pin",
      newValue: {
        channel: "ussd",
        failed_attempts: nextAttempts,
        attempts_remaining: getAttemptsRemaining(nextAttempts),
      },
    });

    return {
      success: false,
      needsSetup: false,
      resetRequired: lockRequired,
      attemptsRemaining: getAttemptsRemaining(nextAttempts),
    };
  }

  await supabase
    .from("users")
    .update({
      transaction_pin_failed_attempts: 0,
      transaction_pin_locked_until: null,
      transaction_pin_enabled: true,
    })
    .eq("id", user.id);

  await logUssdAudit(supabase, {
    userId: user.id,
    action: "ussd_pin_verified",
    resourceType: "transaction_pin",
    newValue: { channel: "ussd" },
  });

  return { success: true };
}

type ActiveChama = { id: string; name: string };
type ActiveSavingsTarget = {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  status: string;
  is_locked?: boolean | null;
  lock_until?: string | null;
};

async function fetchActiveChamas(supabase: any, userId: string): Promise<ActiveChama[]> {
  const lookups = [
    {
      userColumn: "user_id",
      relation: "chamas(id, name)",
      statusColumn: "status",
      statusValue: "active",
    },
    {
      userColumn: "profile_id",
      relation: "groups(id, name)",
      statusColumn: null as string | null,
      statusValue: null,
    },
  ];

  for (const lookup of lookups) {
    let query = supabase
      .from("chama_members")
      .select(lookup.relation)
      .eq(lookup.userColumn, userId);

    if (lookup.statusColumn && lookup.statusValue) {
      query = query.eq(lookup.statusColumn, lookup.statusValue);
    }

    const { data, error } = await query.limit(10);
    if (error || !data) continue;

    const rows = data as Array<{ chamas?: ActiveChama | ActiveChama[]; groups?: ActiveChama | ActiveChama[] }>;
    const mapped = rows.flatMap((row) => {
      const relation = row.chamas ?? row.groups;
      const values = Array.isArray(relation) ? relation : relation ? [relation] : [];
      return values
        .filter((item): item is ActiveChama => Boolean(item?.id))
        .map((item) => ({ id: item.id, name: item.name ?? "Chama" }));
    });

    if (mapped.length > 0) {
      return mapped;
    }
  }

  return [];
}

async function fetchFirstActiveChama(supabase: any, userId: string): Promise<ActiveChama | null> {
  const chamas = await fetchActiveChamas(supabase, userId);
  return chamas[0] ?? null;
}

async function fetchActiveSavingsTargets(supabase: any, userId: string): Promise<ActiveSavingsTarget[]> {
  const { data, error } = await supabase
    .from("user_savings_targets")
    .select("id, name, current_amount, target_amount, status, is_locked, lock_until")
    .eq("user_id", userId)
    .in("status", ["active", "locked"])
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as ActiveSavingsTarget[];
}

async function fetchFirstActiveSavingsTarget(supabase: any, userId: string): Promise<ActiveSavingsTarget | null> {
  const targets = await fetchActiveSavingsTargets(supabase, userId);
  return targets[0] ?? null;
}

async function fetchMshwariPhone(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("mshwari_phone, phone")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return (data.mshwari_phone ?? data.phone ?? null) as string | null;
}

function buildRequestKey(sessionId: string, text: string) {
  return `${sessionId || "no-session"}|${text || ""}`;
}

function isTrustedGatewayRequest(req: Request) {
  if (Deno.env.get("USSD_ALLOW_UNTRUSTED_REQUESTS") === "true") {
    return true;
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return true;
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  return /at-ussd-api|africastalking/i.test(userAgent);
}

async function invokeInternalFunction(functionName: string, body: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "x-client-info": "ratibu-ussd-handler",
    },
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => "");
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

function extractFunctionError(result: { data: unknown }) {
  if (!result.data || typeof result.data !== "object") {
    return "Please try again.";
  }

  const payload = result.data as Record<string, unknown>;
  const error = payload.error;
  const details = payload.details;
  const message = payload.message;
  const parts = [error, message, details].filter((value) => typeof value === "string" && value.trim().length > 0);
  return parts.length > 0 ? String(parts[0]) : "Please try again.";
}

function getTimeGreeting(now = new Date()) {
  const hourText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Africa/Nairobi",
  }).format(now);
  const hour = Number(hourText);

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

async function getCachedUssdResponse(supabase: any, sessionId: string, text: string) {
  const { data, error } = await supabase
    .from("ussd_request_log")
    .select("response_text")
    .eq("session_id", sessionId)
    .eq("request_text", text)
    .maybeSingle();

  if (error || !data?.response_text) return null;
  return data.response_text as string;
}

async function countRecentUssdRequests(supabase: any, phoneNumber: string) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ussd_request_log")
    .select("id", { count: "exact", head: true })
    .eq("phone_number", phoneNumber)
    .gte("created_at", since);

  if (error) return 0;
  return count ?? 0;
}

async function storeUssdResponse(
  supabase: any,
  sessionId: string,
  phoneNumber: string,
  text: string,
  responseText: string,
) {
  await supabase
    .from("ussd_request_log")
    .upsert({
      session_id: sessionId,
      phone_number: phoneNumber,
      request_text: text,
      response_text: responseText,
    }, {
      onConflict: "session_id,request_text",
    });
}

async function logUssdAudit(
  supabase: any,
  entry: {
    userId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
  },
) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: entry.userId ?? null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
  });

  if (error) {
    console.warn("USSD audit log failed:", error.message);
  }
}

async function recordSavingsTransaction(
  supabase: any,
  userId: string,
  target: ActiveSavingsTarget,
  amount: number,
  type: "deposit" | "withdrawal",
) {
  const { data, error } = await supabase.rpc("process_ussd_savings_transaction", {
    p_user_id: userId,
    p_target_id: target.id,
    p_amount: amount,
    p_tx_type: type,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; message?: string; next_amount?: number };

  await logUssdAudit(supabase, {
    userId,
    action: result?.ok === true ? `ussd_savings_${type}` : `ussd_savings_${type}_failed`,
    resourceType: "savings_target",
    resourceId: target.id,
    newValue: {
      channel: "ussd",
      amount,
      next_amount: result?.next_amount ?? null,
      message: result?.message ?? null,
    },
  });

  return {
    ok: result?.ok === true,
    message: result?.message ?? null,
    nextAmount: result?.next_amount ?? null,
  };
}

async function requestChamaWithdrawal(
  supabase: any,
  userId: string,
  chama: ActiveChama,
  amount: number,
) {
  const { data, error } = await supabase.rpc("create_ussd_chama_withdrawal_request", {
    p_user_id: userId,
    p_chama_id: chama.id,
    p_amount: amount,
    p_reason: "USSD withdrawal request",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; message?: string };
  await logUssdAudit(supabase, {
    userId,
    action: result?.ok === true ? "ussd_chama_withdrawal_requested" : "ussd_chama_withdrawal_failed",
    resourceType: "chama",
    resourceId: chama.id,
    newValue: {
      channel: "ussd",
      amount,
      message: result?.message ?? null,
    },
  });

  return { ok: result?.ok === true, message: result?.message ?? null };
}

async function fetchActiveChamaMemberships(supabase: any, userId: string) {
  const lookups = [
    {
      userColumn: "user_id",
      select: "id",
      statusColumn: "status",
      statusValue: "active",
    },
    {
      userColumn: "profile_id",
      select: "group_id",
      statusColumn: null as string | null,
      statusValue: null,
    },
  ];

  for (const lookup of lookups) {
    let query = supabase
      .from("chama_members")
      .select(lookup.select, { count: "exact", head: true })
      .eq(lookup.userColumn, userId);

    if (lookup.statusColumn && lookup.statusValue) {
      query = query.eq(lookup.statusColumn, lookup.statusValue);
    }

    const { count, error } = await query;
    if (!error) {
      return count ?? 0;
    }
  }

  return 0;
}

async function fetchChamaNames(supabase: any, userId: string) {
  const lookups = [
    {
      userColumn: "user_id",
      relation: "chamas(id, name)",
      statusColumn: "status",
      statusValue: "active",
    },
    {
      userColumn: "profile_id",
      relation: "groups(id, name)",
      statusColumn: null as string | null,
      statusValue: null,
    },
  ];

  for (const lookup of lookups) {
    let query = supabase
      .from("chama_members")
      .select(lookup.relation)
      .eq(lookup.userColumn, userId);

    if (lookup.statusColumn && lookup.statusValue) {
      query = query.eq(lookup.statusColumn, lookup.statusValue);
    }

    const { data, error } = await query.limit(3);
    if (!error) {
      return data as Array<{
        chamas?: { id?: string; name?: string } | Array<{ id?: string; name?: string }>;
        groups?: { id?: string; name?: string } | Array<{ id?: string; name?: string }>;
      }>;
    }
  }

  return [];
}

async function fetchSavingsTargets(supabase: any, userId: string) {
  const { data, count, error } = await supabase
    .from("user_savings_targets")
    .select("name, current_amount, target_amount", { count: "exact" })
    .eq("user_id", userId);

  if (error) {
    return { data: [], count: 0 };
  }

  return { data: data ?? [], count: count ?? 0 };
}

async function fetchUpcomingMeeting(supabase: any, chamaId: string) {
  const lookups = [
    { foreignColumn: "chama_id", timeColumn: "date" },
    { foreignColumn: "chama_id", timeColumn: "scheduled_at" },
    { foreignColumn: "group_id", timeColumn: "date" },
    { foreignColumn: "group_id", timeColumn: "scheduled_at" },
  ];

  for (const lookup of lookups) {
    const { data, error } = await supabase
      .from("meetings")
      .select(`title, agenda, ${lookup.timeColumn}`)
      .eq(lookup.foreignColumn, chamaId)
      .gte(lookup.timeColumn, new Date().toISOString())
      .order(lookup.timeColumn, { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data as { title?: string | null; agenda?: string | null; date?: string | null; scheduled_at?: string | null } | null;
    }
  }

  return null;
}

const renderPinPrompt = (name: string, needsSetup = false) =>
  needsSetup
    ? `CON Ratibu\n${getTimeGreeting()} ${name}\nSet your PIN`
    : `CON Ratibu\n${getTimeGreeting()} ${name}\nEnter your PIN`;

const renderMainMenu = (name: string) =>
  `CON Ratibu\n${getTimeGreeting()} ${name}\n1 Dashboard\n2 Chamas\n3 Accounts\n4 Savings\n5 Meetings\n6 Swaps\n7 Profile\n8 Rewards\n9 Create Chama\n00 Exit`;

const renderChamasMenu = () =>
  `CON Ratibu\nChamas\n1 View\n2 Discover\n3 Start\n0 Back\n00 Home`;

const renderAccountsMenu = () =>
  `CON Ratibu\nAccounts\n1 Chama Deposit\n2 Chama Withdrawal\n3 Savings Deposit\n4 Savings Withdrawal\n5 Mshwari\n0 Back\n00 Home`;

const renderSavingsMenu = () =>
  `CON Ratibu\nSavings\n1 Plans\n2 New\n3 Deposit\n4 Withdraw\n5 Lock\n0 Back\n00 Home`;

const renderMeetingsMenu = () =>
  `CON Ratibu\nMeetings\n1 Upcoming\n2 Schedule\n3 Ratibu Meet\n0 Back\n00 Home`;

const renderSwapsMenu = () =>
  `CON Ratibu\nSwaps\n1 Request\n2 My Swaps\n0 Back\n00 Home`;

const renderProfileMenu = () =>
  `CON Ratibu\nProfile\n1 View\n2 Edit\n3 KYC\n0 Back\n00 Home`;

const renderRewardsMenu = () =>
  `CON Ratibu\nRewards\n1 My Rewards\n2 Leaderboard\n0 Back\n00 Home`;

const renderCreateChamaMenu = () =>
  `CON Ratibu\nCreate Chama\n1 Start\n2 Explore\n0 Back\n00 Home`;

const renderChoicePrompt = (message: string) =>
  `CON Ratibu\n${message}\n1 Main menu\n2 Exit`;

const renderLockedPinPrompt = () =>
  `CON Ratibu\nPIN locked. Ask an admin to reset your PIN.\n1 Main menu\n2 Exit`;

function renderSelectionPrompt(title: string, items: Array<{ name: string }>) {
  const lines = items.slice(0, 9).map((item, index) => `${index + 1} ${item.name}`);
  return `CON Ratibu\n${title}\n${lines.join("\n")}\n0 Back\n00 Home`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!isTrustedGatewayRequest(req)) {
      return new Response("END Forbidden request source.", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const body = await req.text();
    const params = new URLSearchParams(body);

    const rawPhoneNumber = params.get("phoneNumber") || "";
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber) || rawPhoneNumber.trim();
    const text = params.get("text") || "";
    const sessionId = params.get("sessionId") || "";
    const serviceCode = params.get("serviceCode") || "";
    const phoneLookupValues = getPhoneLookupValues(rawPhoneNumber);
    const parts = text ? text.split("*") : [];

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response("END USSD handler is missing Supabase configuration.", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const profile = await findUserByPhone(supabase, phoneLookupValues);
    const displayName = buildDisplayName(profile);
    const requestKey = buildRequestKey(sessionId, text);

    console.log(
      `USSD Session ${sessionId} - Phone: ${phoneNumber} - Text: ${text} - Service: ${serviceCode}`,
    );

    const cachedResponse = await getCachedUssdResponse(supabase, sessionId, text);
    if (cachedResponse) {
      return new Response(cachedResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const recentRequestCount = await countRecentUssdRequests(supabase, phoneNumber);
    if (recentRequestCount >= 20) {
      const response = "END Too many requests. Try again soon.";
      await storeUssdResponse(supabase, sessionId, phoneNumber, text, response);
      return new Response(response, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    let response = "";

    if (!profile) {
      response = "END This number is not registered in Ratibu.";
    } else {
      const firstPart = parts[0] ?? "";
      const pin = isValidPin(firstPart) ? firstPart : null;
      const menu = pin ? parts.slice(1) : parts;
      const awaitingPin = text === "";
      const hasTransactionPin = Boolean(profile.transaction_pin_hash && profile.transaction_pin_salt);
      const pinFailedAttempts = Number(profile.transaction_pin_failed_attempts ?? 0);
      const pinLocked = Boolean(
        profile.transaction_pin_hash &&
        profile.transaction_pin_salt &&
        (!profile.transaction_pin_enabled || pinFailedAttempts >= 3),
      );

      if (awaitingPin) {
        response = renderPinPrompt(displayName, !hasTransactionPin);
      } else if (pinLocked && !pin) {
        const recoveryChoice = firstPart;
        if (recoveryChoice === "1") {
          response = renderMainMenu(displayName);
        } else if (recoveryChoice === "2") {
          response = "END Thank you for using Ratibu.";
        } else {
          response = renderLockedPinPrompt();
        }
      } else if (!pin) {
        response = "END Enter your 4-6 digit PIN.";
      } else {
        const pinCheck = await verifyTransactionPin(supabase, profile, pin);

        if (!pinCheck.success) {
          if (pinCheck.needsSetup) {
            response = "END No PIN set. Create one in the app.";
          } else if (pinCheck.resetRequired) {
            response = renderLockedPinPrompt();
          } else {
            response = `END Wrong PIN. ${pinCheck.attemptsRemaining} left.`;
          }
        } else if (menu.length === 0) {
          response = renderMainMenu(displayName);
        } else if (menu[0] === "00") {
          response = "END Thank you for using Ratibu.";
        } else if (menu[0] === "0") {
          response = renderMainMenu(displayName);
        } else if (menu[0] === "1") {
          if (menu.length === 1) {
            const chamaCount = profile?.id ? await fetchActiveChamaMemberships(supabase, profile.id) : 0;
            const { count: savingsCount } = profile?.id
              ? await supabase
                .from("user_savings_targets")
                .select("id", { count: "exact", head: true })
                .eq("user_id", profile.id)
              : { count: 0 };
            const { count: meetingCount } = await supabase
              .from("meetings")
              .select("id", { count: "exact", head: true });

            response = renderChoicePrompt(
              `Ratibu\nDashboard\nChamas ${chamaCount}\nSavings ${savingsCount ?? 0}\nMeetings ${meetingCount ?? 0}`,
            );
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "2") {
          if (menu.length === 1) {
            response = renderChamasMenu();
          } else if (menu[1] === "1") {
            const memberRows = profile?.id ? await fetchChamaNames(supabase, profile.id) : [];
            const chamaNames = memberRows
              .map((row) => {
                const relation = row.chamas ?? row.groups;
                return Array.isArray(relation) ? relation[0]?.name : relation?.name;
              })
              .filter(Boolean)
              .slice(0, 3)
              .join(", ") || "No chamas";
            response = renderChoicePrompt(`Ratibu\nMy Chamas\n${chamaNames}\nTotal ${memberRows.length}`);
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nDiscover Chamas\nBrowse chamas in the app.");
          } else if (menu[1] === "3") {
            response = renderChoicePrompt("Ratibu\nCreate Chama\nStart in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "3") {
          if (menu.length === 1) {
            response = renderAccountsMenu();
          } else if (menu[1] === "1") {
            const chamas = profile?.id ? await fetchActiveChamas(supabase, profile.id) : [];
            if (chamas.length === 0) {
              if (menu.length >= 3) {
                const choice = menu[menu.length - 1];
                response = choice === "1"
                  ? renderMainMenu(displayName)
                  : "END Thank you for using Ratibu.";
              } else {
                response = renderChoicePrompt("Ratibu\nJoin a chama first.");
              }
            } else if (menu.length === 2) {
              response = renderSelectionPrompt("Chama Deposit", chamas);
            } else {
              const selectedToken = menu[2];
              if (selectedToken === "0") {
                response = renderAccountsMenu();
              } else if (selectedToken === "00") {
                response = renderMainMenu(displayName);
              } else {
                const selected = Number(selectedToken);
                if (!Number.isInteger(selected) || selected < 1 || selected > chamas.length) {
                  response = renderSelectionPrompt("Chama Deposit", chamas);
                } else if (menu.length === 3) {
                  response = `CON Ratibu\nChama Deposit\n${chamas[selected - 1].name}\nEnter amount.`;
                } else {
                  const amount = Number(menu[3]);
                  const chama = chamas[selected - 1];
                  if (!Number.isFinite(amount) || amount <= 0) {
                    response = "END Enter a valid amount.";
                  } else if (!profile?.id) {
                    response = "END Can't confirm account.";
                  } else {
                    const phone = profile.phone || phoneNumber;
                    const result = await invokeInternalFunction("trigger-stk-push", {
                      amount,
                      phoneNumber: phone,
                      userId: profile.id,
                      chamaId: chama.id,
                      requestId: requestKey,
                      origin: "ussd",
                    });

                    if (!result.ok) {
                      response = `END Deposit failed. ${extractFunctionError(result)}`;
                    } else {
                      response = "END Deposit sent. Check your phone.";
                    }

                    await logUssdAudit(supabase, {
                      userId: profile.id,
                      action: result.ok ? "ussd_chama_deposit_initiated" : "ussd_chama_deposit_failed",
                      resourceType: "chama",
                      resourceId: chama.id,
                      newValue: {
                        channel: "ussd",
                        amount,
                        message: result.ok ? null : extractFunctionError(result),
                      },
                    });
                  }
                }
              }
            }
          } else if (menu[1] === "2") {
            const chama = profile?.id ? await fetchFirstActiveChama(supabase, profile.id) : null;
            if (!chama) {
              if (menu.length >= 3) {
                const choice = menu[menu.length - 1];
                response = choice === "1"
                  ? renderMainMenu(displayName)
                  : "END Thank you for using Ratibu.";
              } else {
                response = renderChoicePrompt("Ratibu\nJoin a chama first.");
              }
            } else if (menu.length === 2) {
              response = `CON Ratibu\nChama Withdrawal\n${chama.name}\nEnter amount.`;
            } else {
              const amount = Number(menu[2]);
              if (!Number.isFinite(amount) || amount <= 0) {
                response = "END Enter a valid amount.";
              } else if (!profile?.id) {
                response = "END Can't confirm account.";
              } else {
                const result = await requestChamaWithdrawal(supabase, profile.id, chama, amount);
                response = result.ok
                  ? "END Request sent. You'll be notified."
                  : `END Withdrawal failed. ${result.message}`;
              }
            }
          } else if (menu[1] === "3") {
            const target = profile?.id ? await fetchFirstActiveSavingsTarget(supabase, profile.id) : null;
            if (!target) {
              if (menu.length >= 3) {
                const choice = menu[menu.length - 1];
                response = choice === "1"
                  ? renderMainMenu(displayName)
                  : "END Thank you for using Ratibu.";
              } else {
                response = renderChoicePrompt("Ratibu\nCreate a savings target first.");
              }
            } else if (menu.length === 2) {
              response = `CON Ratibu\nSavings Deposit\n${target.name}\nEnter amount.`;
            } else {
              const amount = Number(menu[2]);
              if (!Number.isFinite(amount) || amount <= 0) {
                response = "END Enter a valid amount.";
              } else if (!profile?.id) {
                response = "END Can't confirm account.";
              } else {
                const result = await recordSavingsTransaction(supabase, profile.id, target, amount, "deposit");
                response = result.ok
                  ? `END Deposit recorded. New balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.`
                  : `END Deposit failed. ${result.message}`;
              }
            }
          } else if (menu[1] === "4") {
            const target = profile?.id ? await fetchFirstActiveSavingsTarget(supabase, profile.id) : null;
            if (!target) {
              if (menu.length >= 3) {
                const choice = menu[menu.length - 1];
                response = choice === "1"
                  ? renderMainMenu(displayName)
                  : "END Thank you for using Ratibu.";
              } else {
                response = renderChoicePrompt("Ratibu\nCreate a savings target first.");
              }
            } else if (menu.length === 2) {
              response = `CON Ratibu\nSavings Withdrawal\n${target.name}\nEnter amount.`;
            } else {
              const amount = Number(menu[2]);
              if (!Number.isFinite(amount) || amount <= 0) {
                response = "END Enter a valid amount.";
              } else if (!profile?.id) {
                response = "END Can't confirm account.";
              } else {
                const result = await recordSavingsTransaction(supabase, profile.id, target, amount, "withdrawal");
                response = result.ok
                  ? `END Withdrawal recorded. New balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.`
                  : `END Withdrawal failed. ${result.message}`;
              }
            }
          } else if (menu[1] === "5") {
            const mshwariPhone = profile?.mshwari_phone || await fetchMshwariPhone(supabase, profile.id);
            if (!mshwariPhone) {
              if (menu.length >= 3) {
                const choice = menu[menu.length - 1];
                response = choice === "1"
                  ? renderMainMenu(displayName)
                  : "END Thank you for using Ratibu.";
              } else {
                response = renderChoicePrompt("Ratibu\nLink Mshwari in the app.");
              }
            } else if (menu.length === 2) {
              response = `CON Ratibu\nMshwari Deposit\n${mshwariPhone}\nEnter amount.`;
            } else {
              const amount = Number(menu[2]);
              if (!Number.isFinite(amount) || amount <= 0) {
                response = "END Enter a valid amount.";
              } else if (!profile?.id) {
                response = "END Can't confirm account.";
              } else {
                const phone = profile.phone || phoneNumber;
                const result = await invokeInternalFunction("trigger-stk-push", {
                  amount,
                  phoneNumber: phone,
                  userId: profile.id,
                  destinationType: "mshwari",
                  mshwariPhone,
                  requestId: requestKey,
                  origin: "ussd",
                });

                if (!result.ok) {
                  response = `END Mshwari deposit failed. ${extractFunctionError(result)}`;
                } else {
                  response = "END Mshwari deposit sent. Check your phone.";
                }

                await logUssdAudit(supabase, {
                  userId: profile.id,
                  action: result.ok ? "ussd_mshwari_deposit_initiated" : "ussd_mshwari_deposit_failed",
                  resourceType: "mshwari",
                  newValue: {
                    channel: "ussd",
                    amount,
                    message: result.ok ? null : extractFunctionError(result),
                    mshwari_phone: mshwariPhone,
                  },
                });
              }
            }
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "4") {
          if (menu.length === 1) {
            response = renderSavingsMenu();
          } else if (menu[1] === "1") {
            const { data: savingsTargets, count } = profile?.id
              ? await fetchSavingsTargets(supabase, profile.id)
              : { data: [], count: 0 };
            const summary = (savingsTargets as Array<{ name: string; current_amount: number; target_amount: number }>)
              .slice(0, 3)
              .map((target) => `${target.name}: KES ${Number(target.current_amount || 0).toLocaleString()} / KES ${Number(target.target_amount || 0).toLocaleString()}`)
              .join("\n") || "No savings plans yet";
            response = renderChoicePrompt(`Ratibu\nPersonal Savings\n${summary}\nPlans ${count}`);
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nPersonal Savings\nCreate plans in the app.");
          } else if (menu[1] === "3") {
            const targets = profile?.id ? await fetchActiveSavingsTargets(supabase, profile.id) : [];
            if (targets.length === 0) {
              response = renderChoicePrompt("Ratibu\nCreate a savings target first.");
            } else if (menu.length === 2) {
              response = renderSelectionPrompt("Savings Deposit", targets);
            } else {
              const selectedToken = menu[2];
              if (selectedToken === "0") {
                response = renderSavingsMenu();
              } else if (selectedToken === "00") {
                response = renderMainMenu(displayName);
              } else {
                const selected = Number(selectedToken);
                if (!Number.isInteger(selected) || selected < 1 || selected > targets.length) {
                  response = renderSelectionPrompt("Savings Deposit", targets);
                } else if (menu.length === 3) {
                  response = `CON Ratibu\nSavings Deposit\n${targets[selected - 1].name}\nEnter amount.`;
                } else {
                  const amount = Number(menu[3]);
                  const target = targets[selected - 1];
                  if (!Number.isFinite(amount) || amount <= 0) {
                    response = "END Enter a valid amount.";
                  } else if (!profile?.id) {
                    response = "END Can't confirm account.";
                  } else {
                    const result = await recordSavingsTransaction(supabase, profile.id, target, amount, "deposit");
                    response = result.ok
                      ? `END Deposit recorded. New balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.`
                      : `END Deposit failed. ${result.message}`;
                  }
                }
              }
            }
          } else if (menu[1] === "4") {
            const target = profile?.id ? await fetchFirstActiveSavingsTarget(supabase, profile.id) : null;
            if (!target) {
              response = renderChoicePrompt("Ratibu\nCreate a savings target first.");
            } else if (menu.length === 2) {
              response = `CON Ratibu\nSavings Withdrawal\n${target.name}\nEnter amount.`;
            } else {
              const amount = Number(menu[2]);
              if (!Number.isFinite(amount) || amount <= 0) {
                response = "END Enter a valid amount.";
              } else if (!profile?.id) {
                response = "END Can't confirm account.";
              } else {
                const result = await recordSavingsTransaction(supabase, profile.id, target, amount, "withdrawal");
                response = result.ok
                  ? `END Withdrawal recorded. New balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.`
                  : `END Withdrawal failed. ${result.message}`;
              }
            }
          } else if (menu[1] === "5") {
            response = renderChoicePrompt("Ratibu\nLock Savings\nManage locked savings in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "5") {
          if (menu.length === 1) {
            response = renderMeetingsMenu();
          } else if (menu[1] === "1") {
            const memberRows = profile?.id ? await fetchChamaNames(supabase, profile.id) : [];
            const firstMembership = memberRows[0];
            const chamaId = firstMembership?.chamas && !Array.isArray(firstMembership.chamas)
              ? firstMembership.chamas.id
              : firstMembership?.groups && !Array.isArray(firstMembership.groups)
              ? firstMembership.groups.id
              : null;

            if (!chamaId) {
              response = renderChoicePrompt("Ratibu\nJoin a chama first.");
            } else {
              const meeting = await fetchUpcomingMeeting(supabase, chamaId);
              if (meeting) {
                const scheduledAt = meeting.date || meeting.scheduled_at || "";
                const date = new Date(scheduledAt).toLocaleDateString();
                const time = new Date(scheduledAt).toLocaleTimeString();
                response = renderChoicePrompt(
                  `Ratibu\nUpcoming Meeting\n${meeting.title || "Meeting"}\n${date} ${time}\n${meeting.agenda || "General"}`,
                );
              } else {
                response = renderChoicePrompt("Ratibu\nUpcoming Meetings\nNo upcoming meetings.");
              }
            }
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nSchedule Meetings\nIn the app.");
          } else if (menu[1] === "3") {
            response = renderChoicePrompt("Ratibu\nRatibu Meet\nJoin meetings in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "6") {
          if (menu.length === 1) {
            response = renderSwapsMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePrompt("Ratibu\nRequest Swap\nIn the app.");
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nMy Swaps\nView swaps in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "7") {
          if (menu.length === 1) {
            response = renderProfileMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePrompt(`Ratibu\nProfile\n${displayName}\n${profile?.phone_number || phoneNumber}`);
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nEdit Profile\nUpdate details in the app.");
          } else if (menu[1] === "3") {
            response = renderChoicePrompt("Ratibu\nKYC\nVerify in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "8") {
          if (menu.length === 1) {
            response = renderRewardsMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePrompt("Ratibu\nRewards\nView rewards in the app.");
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nLeaderboard\nView leaderboard in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "9") {
          if (menu.length === 1) {
            response = renderCreateChamaMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePrompt("Ratibu\nCreate Chama\nComplete in the app.");
          } else if (menu[1] === "2") {
            response = renderChoicePrompt("Ratibu\nExplore Chamas\nBrowse chamas in the app.");
          } else {
            response = renderMainMenu(displayName);
          }
        } else {
          response = renderMainMenu(displayName);
        }
      }
    }

    await storeUssdResponse(supabase, sessionId, phoneNumber, text, response);

    return new Response(response, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("USSD Error:", error);
    return new Response("END System error. Please try again later.", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
