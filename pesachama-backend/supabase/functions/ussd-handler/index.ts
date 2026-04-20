import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, ApiKey, X-Client-Info, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const getParamValue = (params: URLSearchParams, names: string[]) => {
  for (const name of names) {
    const value = params.get(name);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const hasUssdCallbackShape = (params: URLSearchParams) => {
  const phoneNumber = getParamValue(params, [
    "phoneNumber",
    "PHONE_NUMBER",
    "msisdn",
    "MSISDN",
    "mobile",
    "MOBILE",
  ]);
  const sessionId = getParamValue(params, ["sessionId", "SESSION_ID", "session_id", "SESSIONID"]);
  const text = getParamValue(params, ["text", "TEXT", "ussd_string", "USSD_STRING", "user_data", "USER_DATA"]);
  return Boolean(phoneNumber && sessionId && text);
};

const buildRequestParams = async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const contentType = req.headers.get("content-type") ?? "";

  if (req.method === "GET") {
    return params;
  }

  const rawBody = await req.text();
  if (!rawBody.trim()) {
    return params;
  }

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          params.set(key, value);
        } else if (typeof value === "number" || typeof value === "boolean") {
          params.set(key, String(value));
        }
      }
      return params;
    } catch {
      return params;
    }
  }

  const formParams = new URLSearchParams(rawBody);
  for (const [key, value] of formParams.entries()) {
    params.set(key, value);
  }

  return params;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const USSD_FLOW_VERSION = "2026-04-18-test3";

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

function findLatestValidPinIndex(parts: string[]) {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (isValidPin(parts[index] ?? "")) {
      return index;
    }
  }
  return -1;
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
type ChamaAllocationSummary = {
  chama_id?: string | null;
  chama_name?: string | null;
  allocation_month?: string | null;
  allocation_day?: number | null;
  swap_month?: string | null;
  swap_requester_day?: number | null;
  swap_target_day?: number | null;
  swap_status?: string | null;
};
type ChamaSwapRequestSummary = {
  id: string;
  month?: string | null;
  requester_day?: number | null;
  target_day?: number | null;
  status?: string | null;
  chama_name?: string | null;
  requester_name?: string | null;
  target_name?: string | null;
};
type PublicChama = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  total_members?: number | null;
  member_limit?: number | null;
};
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
      relation: "role, chamas(id, name)",
      statusColumn: "status",
      statusValue: "active",
    },
    {
      userColumn: "profile_id",
      relation: "role, groups(id, name)",
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

async function fetchChamaAllocationSummary(
  supabase: any,
  userId: string,
  chamaId: string,
): Promise<ChamaAllocationSummary | null> {
  const currentMonth = new Date();
  const monthStart = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1));
  const monthIso = monthStart.toISOString().slice(0, 10);

  const [scheduleResult, swapResult] = await Promise.all([
    supabase
      .from("chama_allocation_schedule")
      .select("chama_id, allocation_month, allocation_day, chamas(name)")
      .eq("user_id", userId)
      .eq("chama_id", chamaId)
      .eq("allocation_month", monthIso)
      .maybeSingle(),
    supabase
      .from("allocation_swap_requests")
      .select("month, requester_day, target_day, status")
      .eq("chama_id", chamaId)
      .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const schedule = scheduleResult.data as {
    chama_id?: string | null;
    allocation_month?: string | null;
    allocation_day?: number | null;
    chamas?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
  const swap = swapResult.data as {
    month?: string | null;
    requester_day?: number | null;
    target_day?: number | null;
    status?: string | null;
  } | null;

  if (!schedule && !swap) return null;

  const chamaName = Array.isArray(schedule?.chamas)
    ? schedule?.chamas?.[0]?.name ?? null
    : schedule?.chamas?.name ?? null;

  return {
    chama_id: schedule?.chama_id ?? chamaId,
    chama_name: chamaName,
    allocation_month: schedule?.allocation_month ?? null,
    allocation_day: schedule?.allocation_day ?? null,
    swap_month: swap?.month ?? null,
    swap_requester_day: swap?.requester_day ?? null,
    swap_target_day: swap?.target_day ?? null,
    swap_status: swap?.status ?? null,
  };
}

async function fetchPendingSwapRequests(supabase: any, userId: string): Promise<ChamaSwapRequestSummary[]> {
  const { data, error } = await supabase
    .from("allocation_swap_requests")
    .select("id, month, requester_day, target_day, status, chamas(name), requester:users!allocation_swap_requests_requester_id_fkey(first_name, last_name), target:users!allocation_swap_requests_target_user_id_fkey(first_name, last_name)")
    .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    month?: string | null;
    requester_day?: number | null;
    target_day?: number | null;
    status?: string | null;
    chamas?: { name?: string | null } | { name?: string | null }[] | null;
    requester?: { first_name?: string | null; last_name?: string | null } | null;
    target?: { first_name?: string | null; last_name?: string | null } | null;
  }>).map((row) => {
    const chama = Array.isArray(row.chamas) ? row.chamas[0] : row.chamas;
    const requesterName = [row.requester?.first_name, row.requester?.last_name].filter(Boolean).join(" ").trim();
    const targetName = [row.target?.first_name, row.target?.last_name].filter(Boolean).join(" ").trim();
    return {
      id: row.id,
      month: row.month ?? null,
      requester_day: row.requester_day ?? null,
      target_day: row.target_day ?? null,
      status: row.status ?? null,
      chama_name: chama?.name ?? null,
      requester_name: requesterName || null,
      target_name: targetName || null,
    };
  });
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
  return `${USSD_FLOW_VERSION}|${sessionId || "no-session"}|${text || ""}`;
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
  if (/mspace|at-ussd-api|africastalking/i.test(userAgent)) {
    return true;
  }

  return false;
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

async function getCachedUssdResponse(supabase: any, requestKey: string) {
  const { data, error } = await supabase
    .from("ussd_request_log")
    .select("response_text")
    .eq("request_text", requestKey)
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
  requestKey: string,
  phoneNumber: string,
  responseText: string,
) {
  await supabase
    .from("ussd_request_log")
    .upsert({
      session_id: sessionId,
      phone_number: phoneNumber,
      request_text: requestKey,
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
    p_channel: "ussd",
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
        role?: string | null;
        chamas?: { id?: string; name?: string } | Array<{ id?: string; name?: string }>;
        groups?: { id?: string; name?: string } | Array<{ id?: string; name?: string }>;
      }>;
    }
  }

  return [];
}

async function fetchPublicChamas(supabase: any): Promise<PublicChama[]> {
  const { data, error } = await supabase
    .from("chamas")
    .select("id, name, description, category, total_members, member_limit, created_at")
    .order("created_at", { ascending: false })
    .limit(16);

  if (error) {
    return [];
  }

  return (data ?? []) as PublicChama[];
}

async function joinPublicChama(supabase: any, userId: string, chamaId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("chama_members")
    .select("chama_id, status")
    .eq("user_id", userId)
    .eq("chama_id", chamaId)
    .maybeSingle();

  if (!existingError && existing) {
    return { ok: false, message: "You are already a member." };
  }

  const { error } = await supabase.from("chama_members").insert({
    chama_id: chamaId,
    user_id: userId,
    role: "member",
    status: "active",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await logUssdAudit(supabase, {
    userId,
    action: "ussd_chama_joined",
    resourceType: "chama",
    resourceId: chamaId,
    newValue: {
      channel: "ussd",
    },
  });

  return { ok: true, message: "Joined successfully." };
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
  `CON Ratibu\n${getTimeGreeting()} ${name}\n${needsSetup ? "Set your PIN" : "Enter your PIN"}`;

const renderPinRetryPrompt = (name: string, attemptsRemaining: number) =>
  `CON Ratibu\n${getTimeGreeting()} ${name}\nWrong PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} left.\nEnter your PIN`;

const renderMainMenu = (name: string) =>
  `CON Ratibu\n${getTimeGreeting()} ${name}\n1 Dashboard\n2 Chamas\n3 Accounts\n4 Savings\n5 Meetings\n6 Swaps\n7 Profile\n8 Rewards\n9 Marketplace\n10 Products\n00 Exit`;

const renderChamasMenu = () =>
  `CON Ratibu\nChamas\n1 My Chamas\n2 Join Chama\n3 Create Chama\n4 Requests\n5 Roles\n0 Back\n00 Home`;

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

const renderProductsMenu = () =>
  `CON Ratibu\nProducts\n1 Send Money\n2 Vendor Payments\n3 Agent Products\n4 Delivery\n5 E-commerce\n6 Credit Score\n7 Apply Product\n8 Application Status\n0 Back\n00 Home`;

const renderMarketplaceMenu = () =>
  `CON Ratibu\nMarketplace\n1 Overview\n2 Send Money\n3 Role Eligibility\n4 Chama Roles\n0 Back\n00 Home`;

const renderChamaActionsMenu = (name: string) =>
  `CON Ratibu\n${name}\n1 Deposit\n2 Withdraw\n3 Swap Date\n0 Back\n00 Home`;

const renderChamaInfoMenu = (title: string, message: string) =>
  `CON Ratibu\n${title}\n${message}\n0 Back\n00 Home`;

type UssdLoanRecord = {
  amount?: number | string | null;
  interest_rate?: number | string | null;
  duration_months?: number | string | null;
  status?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  chamas?: { name?: string | null } | null;
};

function formatLoanMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `KES ${Number.isFinite(amount) ? amount.toLocaleString() : "0"}`;
}

function renderLoansMenu(loans: UssdLoanRecord[]) {
  if (loans.length === 0) {
    return `CON Ratibu\nLoans\nNo loan records yet.\n1 KCB M-PESA\n0 Back\n00 Home`;
  }

  const lines = loans.slice(0, 3).map((loan, index) => {
    const name = loan.chamas?.name?.trim() || "Personal Loan";
    const status = (loan.status ?? "pending").toUpperCase();
    return `${index + 1} ${name} ${formatLoanMoney(loan.amount)} ${status}`;
  });

  const more = loans.length > 3 ? "\n9 More in app" : "";
  return `CON Ratibu\nLoans\n${lines.join("\n")}${more}\n1 KCB M-PESA\n0 Back\n00 Home`;
}

const renderChoicePrompt = (message: string) =>
  `CON Ratibu\n${message}\n1 Main menu\n2 Exit`;

const renderLockedPinPrompt = () =>
  `CON Ratibu\nPIN locked. Ask an admin to reset your PIN.\n1 Main menu\n2 Exit`;

function renderChoicePromptWithActions(message: string, menu: string[], displayName: string) {
  const choice = menu.at(-1);
  if (choice === "1") {
    return renderMainMenu(displayName);
  }
  if (choice === "2" || choice === "00") {
    return "END Thank you for using Ratibu.";
  }
  return renderChoicePrompt(message);
}

function isFollowUpChoiceResponse(responseText: string) {
  return /\n1 Main menu\n2 Exit(?:\n|$)/.test(responseText);
}

function isInfoBackHomeResponse(responseText: string) {
  return /\n0 Back\n00 Home(?:\n|$)/.test(responseText);
}

function getNavigationToken(menu: string[]) {
  const token = menu.at(-1);
  return token === "0" || token === "00" ? token : null;
}

function renderSelectionPrompt(title: string, items: Array<{ name: string }>) {
  const lines = items.slice(0, 9).map((item, index) => `${index + 1} ${item.name}`);
  return `CON Ratibu\n${title}\n${lines.join("\n")}\n0 Back\n00 Home`;
}

function renderDiscoverPrompt(chamas: PublicChama[], page: number) {
  const pageSize = 8;
  const start = page * pageSize;
  const current = chamas.slice(start, start + pageSize);
  const lines = current.map((chama, index) => `${index + 1} ${chama.name}`);
  const more = chamas.length > start + pageSize ? "\n9 More" : "";
  return `CON Ratibu\nDiscover Chamas\n${lines.join("\n")}${more}\n0 Back\n00 Home`;
}

function renderPendingSwapRequestsMenu(requests: ChamaSwapRequestSummary[]) {
  if (requests.length === 0) {
    return `CON Ratibu\nChama Requests\nNo pending swap requests yet.\n0 Back\n00 Home`;
  }

  const lines = requests.slice(0, 5).map((request, index) => {
    const monthLabel = request.month
      ? new Date(`${request.month}`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "Current month";
    const requester = request.requester_name || "Member";
    const target = request.target_name || "Member";
    const dayPair = request.requester_day && request.target_day
      ? `${request.requester_day}->${request.target_day}`
      : `${request.requester_day ?? "-"}->${request.target_day ?? "-"}`;
    return `${index + 1} ${request.chama_name || "Chama"} ${monthLabel} ${dayPair} ${request.status || "pending"} ${requester} ${target}`;
  });

  return `CON Ratibu\nChama Requests\n${lines.join("\n")}\n0 Back\n00 Home`;
}

function resolveInfoNavigation(
  menu: string[],
  lastToken: string,
  parentResponse: string,
  displayName: string,
) {
  if (!isInfoBackHomeResponse(parentResponse)) {
    return null;
  }

  if (lastToken === "00") {
    return renderMainMenu(displayName);
  }

  if (lastToken !== "0") {
    return null;
  }

  const section = menu[0] ?? "";

  if (section === "2") {
    return renderChamasMenu();
  }

  if (section === "9") {
    return renderMarketplaceMenu();
  }

  if (section === "10") {
    return renderProductsMenu();
  }

  return renderMainMenu(displayName);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const params = await buildRequestParams(req);

    if (!isTrustedGatewayRequest(req) && !hasUssdCallbackShape(params)) {
      return new Response("END Forbidden request source.", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const rawPhoneNumber = getParamValue(params, [
      "phoneNumber",
      "PHONE_NUMBER",
      "msisdn",
      "MSISDN",
      "mobile",
      "MOBILE",
    ]);
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber) || rawPhoneNumber.trim();
    const userData = getParamValue(params, ["user_data", "USER_DATA"]);
    const ussdString = getParamValue(params, ["ussd_string", "USSD_STRING"]);
    const textField = getParamValue(params, ["text", "TEXT"]);
    const sessionTextCandidates = [
      { value: textField, source: "TEXT" },
      { value: userData, source: "USER_DATA" },
      { value: ussdString, source: "USSD_STRING" },
    ].filter((candidate) => candidate.value.length > 0);

    const selectedText = sessionTextCandidates.sort((a, b) => {
      const score = (value: string) => value.split("*").length * 10 + value.length;
      return score(b.value) - score(a.value);
    })[0] ?? { value: "", source: "TEXT" };

    const text = selectedText.value;
    const sessionId = getParamValue(params, ["sessionId", "SESSION_ID", "session_id", "SESSIONID"]);
    const serviceCode = getParamValue(params, ["serviceCode", "SERVICE_CODE", "service_code"]);
    const phoneLookupValues = getPhoneLookupValues(rawPhoneNumber);
    const parts = text ? text.split("*").filter(Boolean) : [];
    const initialRequest =
      parts.length === 0 ||
      (serviceCode && parts.length === 1 && parts[0] === serviceCode) ||
      (!serviceCode && parts.length === 1 && /^\d{1,3}$/.test(parts[0] ?? "") && !isValidPin(parts[0]));
    const assignedCodePrefix =
      serviceCode === "702" && parts.length > 0 && /^\d{1,3}$/.test(parts[0] ?? "") ? parts[0] : "";
    const normalizedParts = (() => {
      let tokens = parts.slice();

      if (tokens[0] === "702") {
        tokens = tokens.slice(1);

        if (serviceCode && tokens[0] === serviceCode) {
          tokens = tokens.slice(1);
        } else if (!serviceCode && tokens.length > 1 && /^\d{1,3}$/.test(tokens[0] ?? "")) {
          tokens = tokens.slice(1);
        }
      }

      if (assignedCodePrefix && tokens.length > 1 && tokens[0] === assignedCodePrefix) {
        tokens = tokens.slice(1);
      }

      if (serviceCode && tokens[0] === serviceCode) {
        tokens = tokens.slice(1);
      }

      return tokens;
    })();

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
      `USSD Session ${sessionId} - Phone: ${phoneNumber} - Text: ${text} - USSD_STRING: ${ussdString} - USER_DATA: ${userData} - Service: ${serviceCode}`,
    );

    const cachedResponse = await getCachedUssdResponse(supabase, requestKey);
    if (cachedResponse) {
      return new Response(cachedResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const lastToken = text.split("*").filter(Boolean).at(-1) ?? "";
    const parentText = text.includes("*") ? text.slice(0, text.lastIndexOf("*")) : "";
    if (parentText && lastToken) {
      const parentResponse = await getCachedUssdResponse(supabase, buildRequestKey(sessionId, parentText));
      if (parentResponse && isFollowUpChoiceResponse(parentResponse)) {
        let response = parentResponse;
        if (lastToken === "1" || lastToken === "0") {
          response = renderMainMenu(displayName);
        } else if (lastToken === "2" || lastToken === "00") {
          response = "END Thank you for using Ratibu.";
        }

        await storeUssdResponse(supabase, sessionId, requestKey, phoneNumber, response);
        return new Response(response, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const parentMenu = parentText.split("*").filter(Boolean);
      const infoNavigationResponse = resolveInfoNavigation(parentMenu, lastToken, parentResponse ?? "", displayName);
      if (infoNavigationResponse) {
        await storeUssdResponse(supabase, sessionId, requestKey, phoneNumber, infoNavigationResponse);
        return new Response(infoNavigationResponse, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
    }

    const recentRequestCount = await countRecentUssdRequests(supabase, phoneNumber);
    if (recentRequestCount >= 20) {
      const response = "END Too many requests. Try again soon.";
      await storeUssdResponse(supabase, sessionId, requestKey, phoneNumber, response);
      return new Response(response, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    let response = "";

    if (!profile) {
      response = "END This number is not registered in Ratibu.";
    } else {
      const pinIndex = findLatestValidPinIndex(normalizedParts);
      const pin = pinIndex >= 0 ? normalizedParts[pinIndex] : null;
      const menu = pinIndex >= 0 ? normalizedParts.slice(pinIndex + 1) : normalizedParts;
      const awaitingPin = initialRequest;
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
        const recoveryChoice = menu[0] ?? "";
        if (recoveryChoice === "1") {
          response = renderMainMenu(displayName);
        } else if (recoveryChoice === "2") {
          response = "END Thank you for using Ratibu.";
        } else {
          response = renderLockedPinPrompt();
        }
      } else if (!pin) {
        response = renderPinPrompt(displayName, !hasTransactionPin);
      } else {
        const pinCheck = await verifyTransactionPin(supabase, profile, pin);

        if (!pinCheck.success) {
          if (pinCheck.needsSetup) {
            response = "END No PIN set. Create one in the app.";
          } else if (pinCheck.resetRequired) {
            response = renderLockedPinPrompt();
          } else {
            response = renderPinRetryPrompt(displayName, pinCheck.attemptsRemaining);
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

            response = renderChoicePromptWithActions(
              `Ratibu\nDashboard\nChamas ${chamaCount}\nSavings ${savingsCount ?? 0}\nMeetings ${meetingCount ?? 0}`,
              menu,
              displayName,
            );
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "2") {
          if (menu.length === 1) {
            response = renderChamasMenu();
          } else if (menu[1] === "1") {
            const activeChamas = profile?.id ? await fetchActiveChamas(supabase, profile.id) : [];
            if (activeChamas.length === 0) {
              const navigation = getNavigationToken(menu);
              if (menu.length > 2 && navigation === "0") {
                response = renderChamasMenu();
              } else if (menu.length > 2 && navigation === "00") {
                response = renderMainMenu(displayName);
              } else {
                response = renderChamaInfoMenu("My Chamas", "You are not in any chamas yet.");
              }
            } else if (menu.length === 2) {
              response = renderSelectionPrompt("My Chamas", activeChamas);
            } else if (menu.length === 3) {
              const navigation = getNavigationToken(menu);
              if (navigation === "0") {
                response = renderChamasMenu();
              } else if (navigation === "00") {
                response = renderMainMenu(displayName);
              } else {
                response = renderSelectionPrompt("My Chamas", activeChamas);
              }
            } else {
              const selectedToken = menu[2];
              if (selectedToken === "0") {
                response = renderChamasMenu();
              } else if (selectedToken === "00") {
                response = renderMainMenu(displayName);
              } else {
                const selected = Number(selectedToken);
                if (!Number.isInteger(selected) || selected < 1 || selected > activeChamas.length) {
                  response = renderSelectionPrompt("My Chamas", activeChamas);
                } else {
                  const chama = activeChamas[selected - 1];
                  if (menu.length === 3) {
                    response = renderChamaActionsMenu(chama.name);
                  } else {
                    const action = menu[3];
                    if (action === "0") {
                      response = renderSelectionPrompt("My Chamas", activeChamas);
                    } else if (action === "00") {
                      response = renderMainMenu(displayName);
                    } else if (action === "1") {
                      if (menu.length === 4) {
                        response = `CON Ratibu\nChama Deposit\n${chama.name}\nEnter amount.\n0 Back\n00 Home`;
                      } else {
                        const amountToken = menu[4];
                        if (amountToken === "0") {
                          response = renderChamaActionsMenu(chama.name);
                        } else if (amountToken === "00") {
                          response = renderMainMenu(displayName);
                        } else {
                          const amount = Number(amountToken);
                          if (!Number.isFinite(amount) || amount <= 0) {
                            response = `CON Ratibu\nChama Deposit\n${chama.name}\nEnter amount.\n0 Back\n00 Home`;
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

                            response = result.ok
                              ? renderChoicePromptWithActions(
                                "Ratibu\nDeposit sent. Check your phone.\nAnything else?",
                                menu,
                                displayName,
                              )
                              : renderChoicePromptWithActions(
                                `Ratibu\nDeposit failed. ${extractFunctionError(result)}\nAnything else?`,
                                menu,
                                displayName,
                              );
                          }
                        }
                      }
                    } else if (action === "2") {
                      if (menu.length === 4) {
                        response = `CON Ratibu\nChama Withdrawal\n${chama.name}\nEnter amount.\n0 Back\n00 Home`;
                      } else {
                        const amountToken = menu[4];
                        if (amountToken === "0") {
                          response = renderChamaActionsMenu(chama.name);
                        } else if (amountToken === "00") {
                          response = renderMainMenu(displayName);
                        } else {
                          const amount = Number(amountToken);
                          if (!Number.isFinite(amount) || amount <= 0) {
                            response = `CON Ratibu\nChama Withdrawal\n${chama.name}\nEnter amount.\n0 Back\n00 Home`;
                          } else if (!profile?.id) {
                            response = "END Can't confirm account.";
                          } else {
                            const result = await requestChamaWithdrawal(supabase, profile.id, chama, amount);
                            response = result.ok
                              ? renderChoicePromptWithActions(
                                "Ratibu\nWithdrawal request sent.\nAnything else?",
                                menu,
                                displayName,
                              )
                              : renderChoicePromptWithActions(
                                `Ratibu\nWithdrawal failed. ${result.message}\nAnything else?`,
                                menu,
                                displayName,
                              );
                          }
                        }
                      }
                    } else if (action === "3") {
                      const summary = await fetchChamaAllocationSummary(supabase, profile.id, chama.id);
                      if (!summary) {
                        response = renderChamaInfoMenu(chama.name, "No swap date found yet.");
                      } else {
                        const monthLabel = summary.allocation_month
                          ? new Date(`${summary.allocation_month}`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                          : "Current month";
                        const swapLine = summary.swap_month
                          ? `Swap request: ${new Date(`${summary.swap_month}`).toLocaleDateString("en-US", { month: "short", year: "numeric" })} (${summary.swap_status ?? "pending"})`
                          : "Swap request: none";
                        response = renderChamaInfoMenu(
                          chama.name,
                          `Allocation date: Day ${summary.allocation_day ?? "-"}\nMonth: ${monthLabel}\n${swapLine}`,
                        );
                      }
                    } else {
                      response = renderChamaActionsMenu(chama.name);
                    }
                  }
                }
              }
            }
          } else if (menu[1] === "2") {
            const publicChamas = profile?.id ? await fetchPublicChamas(supabase) : [];
            if (publicChamas.length === 0) {
              const navigation = getNavigationToken(menu);
              if (menu.length > 2 && navigation === "0") {
                response = renderChamasMenu();
              } else if (menu.length > 2 && navigation === "00") {
                response = renderMainMenu(displayName);
              } else {
                response = renderChamaInfoMenu("Join Chama", "No public chamas yet.");
              }
            } else {
              const discoverTokens = menu.slice(2);
              const isSecondPage = discoverTokens[0] === "9";
              const page = isSecondPage ? 1 : 0;

              if (discoverTokens.length === 0 || (isSecondPage && discoverTokens.length === 1)) {
                response = renderDiscoverPrompt(publicChamas, page);
              } else {
                const selectionToken = isSecondPage ? discoverTokens[1] : discoverTokens[0];
                if (selectionToken === "0") {
                  response = renderChamasMenu();
                } else if (selectionToken === "00") {
                  response = renderMainMenu(displayName);
                } else if (selectionToken === "9" && page === 0) {
                  response = renderDiscoverPrompt(publicChamas, 1);
                } else {
                  const selectedIndex = Number(selectionToken);
                  const start = page * 8;
                  const selectedChama = publicChamas[start + selectedIndex - 1];

                  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || !selectedChama) {
                    response = renderDiscoverPrompt(publicChamas, page);
                  } else if (!profile?.id) {
                    response = "END Can't confirm account.";
                  } else {
                    const joinResult = await joinPublicChama(supabase, profile.id, selectedChama.id);
                    response = joinResult.ok
                      ? `END Joined ${selectedChama.name}. Open Chamas to manage it.`
                      : `END ${joinResult.message || "Join failed."}`;
                  }
                }
              }
            }
          } else if (menu[1] === "3") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderChamasMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu("Create Chama", "Start in the app.");
            }
          } else if (menu[1] === "4") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderChamasMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              const swapRequests = profile?.id ? await fetchPendingSwapRequests(supabase, profile.id) : [];
              response = renderPendingSwapRequestsMenu(swapRequests);
            }
          } else if (menu[1] === "5") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderChamasMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              const chamaMemberships = profile?.id ? await fetchChamaNames(supabase, profile.id) : [];
              const lines = chamaMemberships.length
                ? chamaMemberships.slice(0, 3).map((row) => {
                  const relation = row.chamas ?? row.groups;
                  const name = Array.isArray(relation) ? relation[0]?.name : relation?.name;
                  return `${name || "Chama"}: ${row.role || "member"}`;
                }).join("\n")
                : "No chama roles yet";
              response = renderChamaInfoMenu("Chama Roles", `Admin, Treasurer, Secretary, Member\n${lines}`);
            }
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
                response = renderChoicePromptWithActions("Ratibu\nJoin a chama first.", menu, displayName);
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
                      response = renderChoicePromptWithActions(
                        `Ratibu\nDeposit failed. ${extractFunctionError(result)}\nAnything else?`,
                        menu,
                        displayName,
                      );
                    } else {
                      response = renderChoicePromptWithActions(
                        "Ratibu\nDeposit sent. Check your phone.\nAnything else?",
                        menu,
                        displayName,
                      );
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
                response = renderChoicePromptWithActions("Ratibu\nJoin a chama first.", menu, displayName);
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
                  ? renderChoicePromptWithActions(
                    "Ratibu\nRequest sent. You'll be notified.\nAnything else?",
                    menu,
                    displayName,
                  )
                  : renderChoicePromptWithActions(
                    `Ratibu\nWithdrawal failed. ${result.message}\nAnything else?`,
                    menu,
                    displayName,
                  );
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
                response = renderChoicePromptWithActions("Ratibu\nCreate a savings target first.", menu, displayName);
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
                  ? renderChoicePromptWithActions(
                    `Ratibu\nDeposit recorded.\nNew balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.\nAnything else?`,
                    menu,
                    displayName,
                  )
                  : renderChoicePromptWithActions(
                    `Ratibu\nDeposit failed. ${result.message}\nAnything else?`,
                    menu,
                    displayName,
                  );
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
                response = renderChoicePromptWithActions("Ratibu\nCreate a savings target first.", menu, displayName);
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
                  ? renderChoicePromptWithActions(
                    `Ratibu\nWithdrawal recorded.\nNew balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.\nAnything else?`,
                    menu,
                    displayName,
                  )
                  : renderChoicePromptWithActions(
                    `Ratibu\nWithdrawal failed. ${result.message}\nAnything else?`,
                    menu,
                    displayName,
                  );
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
                response = renderChoicePromptWithActions("Ratibu\nLink Mshwari in the app.", menu, displayName);
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
                  response = renderChoicePromptWithActions(
                    `Ratibu\nMshwari deposit failed. ${extractFunctionError(result)}\nAnything else?`,
                    menu,
                    displayName,
                  );
                } else {
                  response = renderChoicePromptWithActions(
                    "Ratibu\nMshwari deposit sent. Check your phone.\nAnything else?",
                    menu,
                    displayName,
                  );
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
            response = renderChoicePromptWithActions(`Ratibu\nPersonal Savings\n${summary}\nPlans ${count}`, menu, displayName);
          } else if (menu[1] === "2") {
            response = renderChoicePromptWithActions("Ratibu\nPersonal Savings\nCreate plans in the app.", menu, displayName);
          } else if (menu[1] === "3") {
            const targets = profile?.id ? await fetchActiveSavingsTargets(supabase, profile.id) : [];
            if (targets.length === 0) {
              response = renderChoicePromptWithActions("Ratibu\nCreate a savings target first.", menu, displayName);
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
                      ? renderChoicePromptWithActions(
                        `Ratibu\nDeposit recorded.\nNew balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.\nAnything else?`,
                        menu,
                        displayName,
                      )
                      : renderChoicePromptWithActions(
                        `Ratibu\nDeposit failed. ${result.message}\nAnything else?`,
                        menu,
                        displayName,
                      );
                  }
                }
              }
            }
          } else if (menu[1] === "4") {
            const target = profile?.id ? await fetchFirstActiveSavingsTarget(supabase, profile.id) : null;
            if (!target) {
                response = renderChoicePromptWithActions("Ratibu\nCreate a savings target first.", menu, displayName);
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
                  ? renderChoicePromptWithActions(
                    `Ratibu\nWithdrawal recorded.\nNew balance: KES ${Number(result.nextAmount ?? 0).toLocaleString()}.\nAnything else?`,
                    menu,
                    displayName,
                  )
                  : renderChoicePromptWithActions(
                    `Ratibu\nWithdrawal failed. ${result.message}\nAnything else?`,
                    menu,
                    displayName,
                  );
              }
            }
          } else if (menu[1] === "5") {
            response = renderChoicePromptWithActions("Ratibu\nLock Savings\nManage locked savings in the app.", menu, displayName);
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
              response = renderChoicePromptWithActions("Ratibu\nJoin a chama first.", menu, displayName);
            } else {
              const meeting = await fetchUpcomingMeeting(supabase, chamaId);
              if (meeting) {
                const scheduledAt = meeting.date || meeting.scheduled_at || "";
                const date = new Date(scheduledAt).toLocaleDateString();
                const time = new Date(scheduledAt).toLocaleTimeString();
                response = renderChoicePromptWithActions(
                  `Ratibu\nUpcoming Meeting\n${meeting.title || "Meeting"}\n${date} ${time}\n${meeting.agenda || "General"}`,
                  menu,
                  displayName,
                );
              } else {
                response = renderChoicePromptWithActions("Ratibu\nUpcoming Meetings\nNo upcoming meetings.", menu, displayName);
              }
            }
          } else if (menu[1] === "2") {
            response = renderChoicePromptWithActions("Ratibu\nSchedule Meetings\nIn the app.", menu, displayName);
          } else if (menu[1] === "3") {
            response = renderChoicePromptWithActions("Ratibu\nRatibu Meet\nJoin meetings in the app.", menu, displayName);
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "6") {
          if (menu.length === 1) {
            response = renderSwapsMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePromptWithActions("Ratibu\nRequest Swap\nIn the app.", menu, displayName);
          } else if (menu[1] === "2") {
            response = renderChoicePromptWithActions("Ratibu\nMy Swaps\nView swaps in the app.", menu, displayName);
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "7") {
          if (menu.length === 1) {
            response = renderProfileMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePromptWithActions(`Ratibu\nProfile\n${displayName}\n${profile?.phone_number || phoneNumber}`, menu, displayName);
          } else if (menu[1] === "2") {
            response = renderChoicePromptWithActions("Ratibu\nEdit Profile\nUpdate details in the app.", menu, displayName);
          } else if (menu[1] === "3") {
            response = renderChoicePromptWithActions("Ratibu\nKYC\nVerify in the app.", menu, displayName);
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "8") {
          if (menu.length === 1) {
            response = renderRewardsMenu();
          } else if (menu[1] === "1") {
            response = renderChoicePromptWithActions("Ratibu\nRewards\nView rewards in the app.", menu, displayName);
          } else if (menu[1] === "2") {
            response = renderChoicePromptWithActions("Ratibu\nLeaderboard\nView leaderboard in the app.", menu, displayName);
          } else {
            response = renderMainMenu(displayName);
          }
        } else if (menu[0] === "9") {
          if (menu.length === 1) {
            response = renderMarketplaceMenu();
          } else if (menu[1] === "1") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderMarketplaceMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else if (!profile?.id) {
              response = "END Can't confirm account.";
            } else {
              const overview = await supabase.rpc("get_marketplace_overview", { p_user_id: profile.id });
              const data = overview.data as {
                ok?: boolean;
                user?: { credit_score?: number; credit_tier?: string; wallet_balance?: number };
                eligible_roles?: { vendor?: boolean; agent?: boolean; rider?: boolean };
              } | null;

              if (overview.error || !data?.ok) {
                response = renderChamaInfoMenu("Marketplace", "Overview is unavailable right now.");
              } else {
                const eligible = data.eligible_roles || {};
                response = renderChamaInfoMenu(
                  "Marketplace",
                  `Score ${data.user?.credit_score ?? 500}\nTier ${data.user?.credit_tier ?? "starter"}\nWallet KES ${Number(data.user?.wallet_balance ?? 0).toLocaleString()}\nVendor ${eligible.vendor ? "Yes" : "No"}\nAgent ${eligible.agent ? "Yes" : "No"}\nRider ${eligible.rider ? "Yes" : "No"}\nChama admin +20, treasurer +15, secretary +10`,
                );
              }
            }
          } else if (menu[1] === "2") {
            const navigation = getNavigationToken(menu);
            if (menu.length === 2) {
              response = `CON Ratibu\nMarketplace\nEnter recipient phone.\n0 Back\n00 Home`;
            } else if (navigation === "0") {
              response = renderMarketplaceMenu();
            } else if (navigation === "00") {
              response = renderMainMenu(displayName);
            } else if (menu.length === 3) {
              if (menu[2] === "0") {
                response = renderMarketplaceMenu();
              } else if (menu[2] === "00") {
                response = renderMainMenu(displayName);
              } else {
                response = `CON Ratibu\nMarketplace\n${menu[2]}\nEnter amount.\n0 Back\n00 Home`;
              }
            } else {
              const recipientPhone = menu[2];
              const amount = Number(menu[3]);
              if (!profile?.id) {
                response = "END Can't confirm account.";
              } else if (!recipientPhone || !Number.isFinite(amount) || amount <= 0) {
                response = "END Enter a valid phone number and amount.";
              } else {
                const transfer = await supabase.rpc("internal_wallet_transfer", {
                  p_sender_user_id: profile.id,
                  p_receiver_phone: recipientPhone,
                  p_amount: amount,
                  p_note: "USSD Ratibu wallet transfer",
                });

                const result = transfer.data as { ok?: boolean; message?: string } | null;
                response = renderChoicePromptWithActions(
                  result?.ok
                    ? `Ratibu\n${result.message || "Transfer completed."}\nAnything else?`
                    : `Ratibu\nTransfer failed. ${result?.message || "Please try again."}\nAnything else?`,
                  menu,
                  displayName,
                );
              }
            }
          } else if (menu[1] === "3") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderMarketplaceMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu(
                "Role Eligibility",
                "Vendor 600+\nRider 650+\nAgent 700+\nChama roles can also raise your score.",
              );
            }
          } else if (menu[1] === "4") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderMarketplaceMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              const chamaMemberships = profile?.id ? await fetchChamaNames(supabase, profile.id) : [];
              const chamaRoles = chamaMemberships.length
                ? chamaMemberships.slice(0, 3).map((row) => {
                  const relation = row.chamas ?? row.groups;
                  const name = Array.isArray(relation) ? relation[0]?.name : relation?.name;
                  return `${name || "Chama"}: ${row.role || "member"}`;
                }).join("\n")
                : "No chama roles yet";

              response = renderChamaInfoMenu("Chama Roles", `Admin, Treasurer, Secretary, Member\n${chamaRoles}`);
            }
          } else {
            response = renderMarketplaceMenu();
          }
        } else if (menu[0] === "10") {
          if (menu.length === 1) {
            response = renderProductsMenu();
          } else if (menu[1] === "1") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu("Send Money", "Use Marketplace > Send Money for wallet transfers.");
            }
          } else if (menu[1] === "2") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu("Vendor Payments", "Vendors get till numbers in the app or website.");
            }
          } else if (menu[1] === "3") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu("Agent Products", "Agents apply and receive agent numbers in the app.");
            }
          } else if (menu[1] === "4") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu("Delivery", "Riders are assigned delivery jobs in the app.");
            }
          } else if (menu[1] === "5") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else {
              response = renderChamaInfoMenu("E-commerce", "Browse vendor products in the app or website.");
            }
          } else if (menu[1] === "6") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else if (!profile?.id) {
              response = "END Can't confirm account.";
            } else {
              const overview = await supabase.rpc("get_credit_score_breakdown", { p_user_id: profile.id });
              const data = overview.data as {
                ok?: boolean;
                user?: { credit_score?: number; credit_tier?: string };
                eligible_roles?: { vendor?: boolean; agent?: boolean; rider?: boolean };
                summary?: string;
              } | null;

              if (overview.error || !data?.ok) {
                response = renderChamaInfoMenu("Credit Score", "Score is unavailable right now.");
              } else {
                const eligible = data.eligible_roles || {};
                response = renderChamaInfoMenu(
                  "Credit Score",
                  `Score ${data.user?.credit_score ?? 500}\nTier ${data.user?.credit_tier ?? "starter"}\nVendor ${eligible.vendor ? "Yes" : "No"}\nAgent ${eligible.agent ? "Yes" : "No"}\nRider ${eligible.rider ? "Yes" : "No"}`,
                );
              }
            }
          } else if (menu[1] === "7") {
            if (menu.length === 2) {
              response = `CON Ratibu\nApply Product\n1 Vendor\n2 Rider\n3 Agent\n0 Back\n00 Home`;
            } else if (menu.length === 3) {
              const roleToken = menu[2];
              const roleLabel = roleToken === "1" ? "Vendor" : roleToken === "2" ? "Rider" : roleToken === "3" ? "Agent" : "";
              if (roleToken === "0") {
                response = renderProductsMenu();
              } else if (roleToken === "00") {
                response = renderMainMenu(displayName);
              } else if (!roleLabel) {
                response = renderProductsMenu();
              } else {
                response = `CON Ratibu\nApply ${roleLabel}\nEnter business or display name.\n0 Back\n00 Home`;
              }
            } else {
              const roleToken = menu[2];
              const role = roleToken === "1" ? "vendor" : roleToken === "2" ? "rider" : roleToken === "3" ? "agent" : "";
              const roleLabel = roleToken === "1" ? "Vendor" : roleToken === "2" ? "Rider" : roleToken === "3" ? "Agent" : "";
              const businessName = menu[3]?.trim();

              if (!role || !roleLabel) {
                response = renderProductsMenu();
              } else if (businessName === "0") {
                response = `CON Ratibu\nApply Product\n1 Vendor\n2 Rider\n3 Agent\n0 Back\n00 Home`;
              } else if (businessName === "00") {
                response = renderMainMenu(displayName);
              } else if (!businessName) {
                response = `CON Ratibu\nApply ${roleLabel}\nEnter business or display name.\n0 Back\n00 Home`;
              } else if (!profile?.id) {
                response = "END Can't confirm account.";
              } else {
                const roleResult = await supabase.rpc("request_marketplace_role", {
                  p_user_id: profile.id,
                  p_role: role,
                  p_business_name: businessName,
                  p_display_name: businessName,
                  p_service_category: roleLabel,
                  p_notes: "USSD application",
                });

                const data = roleResult.data as { ok?: boolean; message?: string; required_score?: number; current_score?: number } | null;
                if (roleResult.error || !data?.ok) {
                  response = renderChoicePromptWithActions(
                    `Ratibu\n${data?.message || roleResult.error?.message || "Application failed."}\nAnything else?`,
                    menu,
                    displayName,
                  );
                } else {
                  response = renderChoicePromptWithActions(
                    `Ratibu\n${data.message || `${roleLabel} application submitted.`}\nAnything else?`,
                    menu,
                    displayName,
                  );
                }
              }
            }
          } else if (menu[1] === "8") {
            const navigation = getNavigationToken(menu);
            if (menu.length > 2 && navigation === "0") {
              response = renderProductsMenu();
            } else if (menu.length > 2 && navigation === "00") {
              response = renderMainMenu(displayName);
            } else if (!profile?.id) {
              response = "END Can't confirm account.";
            } else {
              const overview = await supabase.rpc("get_marketplace_overview", { p_user_id: profile.id });
              const data = overview.data as {
                ok?: boolean;
                applications?: Array<{
                  role?: string | null;
                  status?: string | null;
                  business_name?: string | null;
                  display_name?: string | null;
                  required_score?: number | null;
                  score_snapshot?: number | null;
                  created_at?: string | null;
                }>;
              } | null;

              if (overview.error || !data?.ok) {
                response = renderChamaInfoMenu("Application Status", "Status is unavailable right now.");
              } else {
                const applications = Array.isArray(data.applications) ? data.applications.slice(0, 3) : [];
                if (applications.length === 0) {
                  response = renderChamaInfoMenu("Application Status", "No applications yet.");
                } else {
                  const lines = applications.map((app, index) => {
                    const role = String(app.role || "role").toUpperCase();
                    const status = String(app.status || "pending").toUpperCase();
                    const score = app.score_snapshot ?? 0;
                    const required = app.required_score ?? 0;
                    return `${index + 1} ${role} ${status} ${score}/${required}`;
                  }).join("\n");
                  response = renderChamaInfoMenu("Application Status", lines);
                }
              }
            }
          } else {
            response = renderProductsMenu();
          }
        } else {
          response = renderMainMenu(displayName);
        }
      }
    }

    await storeUssdResponse(supabase, sessionId, requestKey, phoneNumber, response);

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

