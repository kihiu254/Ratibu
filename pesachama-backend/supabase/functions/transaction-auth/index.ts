import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const isValidPin = (pin: unknown) =>
  typeof pin === "string" && /^\d{4,6}$/.test(pin);

const maxPinAttempts = 3;

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

type UserRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  system_role?: string | null;
  transaction_pin_enabled?: boolean | null;
  transaction_pin_hash?: string | null;
  transaction_pin_salt?: string | null;
  transaction_pin_failed_attempts?: number | null;
  transaction_pin_locked_until?: string | null;
};

type ProfileRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
};

function getAttemptsRemaining(failedAttempts: number | null | undefined) {
  const attempts = Number(failedAttempts ?? 0);
  return Math.max(0, maxPinAttempts - attempts);
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

async function ensureUserRow(supabase: any, userId: string) {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, first_name, last_name, phone, email, system_role, transaction_pin_enabled, transaction_pin_hash, transaction_pin_salt, transaction_pin_failed_attempts, transaction_pin_locked_until")
    .eq("id", userId)
    .maybeSingle();

  if (!userError && userRow) {
    return userRow as UserRow;
  }

  const [profileResult, authResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, phone_number")
      .eq("id", userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  const profile = (!profileResult.error ? profileResult.data : null) as ProfileRow | null;
  const authUser = authResult.data?.user ?? null;
  const authMeta = authUser?.user_metadata ?? {};
  const nameFromMeta = splitFullName(authMeta.full_name ?? authMeta.name);
  const firstName = profile?.first_name ?? authMeta.first_name ?? nameFromMeta.first_name ?? "";
  const lastName = profile?.last_name ?? authMeta.last_name ?? nameFromMeta.last_name ?? "";
  const phone = profile?.phone_number ?? authMeta.phone ?? authUser?.phone ?? "";

  const { data: upserted, error: upsertError } = await supabase
    .from("users")
    .upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      phone,
    } as any, { onConflict: "id" })
    .select("id, first_name, last_name, phone, email, system_role, transaction_pin_enabled, transaction_pin_hash, transaction_pin_salt, transaction_pin_failed_attempts, transaction_pin_locked_until")
    .single();

  if (upsertError) {
    throw upsertError;
  }

  return upserted as UserRow;
}

async function assertAdmin(supabase: any, userId: string) {
  const userRow = await ensureUserRow(supabase, userId);
  const role = String(userRow?.system_role ?? "user");
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Admin access required");
  }
  return userRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const token = getBearerToken(authHeader);
  if (!token) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const action = String(payload.action || "status");
  const pin = payload.pin;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userResult.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = userResult.user.id;
  const userRow = await ensureUserRow(supabase, userId);

  if (action === "status") {
    const hasPin = Boolean(userRow?.transaction_pin_hash);
    const failedAttempts = Number(userRow?.transaction_pin_failed_attempts ?? 0);
    const lockedOut = hasPin && (!userRow?.transaction_pin_enabled || failedAttempts >= maxPinAttempts);

    return jsonResponse({
      enabled: Boolean(userRow?.transaction_pin_enabled),
      needsSetup: !hasPin,
      resetRequired: lockedOut,
      attemptsRemaining: getAttemptsRemaining(failedAttempts),
      lockedUntil: userRow?.transaction_pin_locked_until ?? null,
    });
  }

  if (action === "set") {
    if (!isValidPin(pin)) {
      return jsonResponse({ error: "PIN must be 4 to 6 digits" }, 400);
    }

    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = bytesToHex(saltBytes);
    const pinHash = await hashPin(String(pin), salt);

    const { error } = await supabase
      .from("users")
      .update({
        transaction_pin_hash: pinHash,
        transaction_pin_salt: salt,
        transaction_pin_enabled: true,
        transaction_pin_updated_at: new Date().toISOString(),
        transaction_pin_failed_attempts: 0,
        transaction_pin_locked_until: null,
      })
      .eq("id", userId);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true, enabled: true });
  }

  if (action === "admin_reset") {
    if (!payload.targetUserId || typeof payload.targetUserId !== "string") {
      return jsonResponse({ error: "Missing targetUserId" }, 400);
    }

    await assertAdmin(supabase, userId);
    const targetUserId = String(payload.targetUserId);
    const targetUser = await ensureUserRow(supabase, targetUserId);

    const { error } = await supabase
      .from("users")
      .update({
        transaction_pin_hash: null,
        transaction_pin_salt: null,
        transaction_pin_enabled: false,
        transaction_pin_updated_at: new Date().toISOString(),
        transaction_pin_failed_attempts: 0,
        transaction_pin_locked_until: null,
      })
      .eq("id", targetUserId);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "transaction_pin_admin_reset",
      resource_type: "transaction_pin",
      resource_id: targetUserId,
      old_value: {
        enabled: targetUser?.transaction_pin_enabled ?? null,
        failed_attempts: targetUser?.transaction_pin_failed_attempts ?? null,
        locked_until: targetUser?.transaction_pin_locked_until ?? null,
        has_pin: Boolean(targetUser?.transaction_pin_hash),
      },
      new_value: {
        enabled: false,
        cleared: true,
        target_user_id: targetUserId,
      },
    });

    return jsonResponse({ success: true, reset: true, targetUserId });
  }

  if (action === "admin_password_reset") {
    if (!payload.targetUserId || typeof payload.targetUserId !== "string") {
      return jsonResponse({ error: "Missing targetUserId" }, 400);
    }

    const redirectTo = typeof payload.redirectTo === "string" && payload.redirectTo.trim()
      ? payload.redirectTo.trim()
      : "https://ratibu.vercel.app/reset-password";

    await assertAdmin(supabase, userId);
    const targetUserId = String(payload.targetUserId);
    const targetAuthUser = await supabase.auth.admin.getUserById(targetUserId);
    const targetEmail = targetAuthUser.data?.user?.email ?? null;

    if (!targetEmail) {
      return jsonResponse({ error: "Target user does not have an email address" }, 400);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "password_reset_admin_requested",
      resource_type: "user_auth",
      resource_id: targetUserId,
      old_value: {
        email: targetEmail,
      },
      new_value: {
        redirect_to: redirectTo,
        password_reset_requested: true,
      },
    });

    return jsonResponse({ success: true, reset: true, targetUserId, emailSent: true });
  }

  if (action === "reset") {
    if (!isValidPin(pin)) {
      return jsonResponse({ error: "PIN must be 4 to 6 digits" }, 400);
    }

    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = bytesToHex(saltBytes);
    const pinHash = await hashPin(String(pin), salt);

    const { error } = await supabase
      .from("users")
      .update({
        transaction_pin_hash: pinHash,
        transaction_pin_salt: salt,
        transaction_pin_enabled: true,
        transaction_pin_updated_at: new Date().toISOString(),
        transaction_pin_failed_attempts: 0,
        transaction_pin_locked_until: null,
      })
      .eq("id", userId);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true, enabled: true, reset: true });
  }

  if (action === "verify") {
    if (!isValidPin(pin)) {
      return jsonResponse({ error: "PIN must be 4 to 6 digits" }, 400);
    }

    const hasPin = Boolean(userRow?.transaction_pin_hash && userRow?.transaction_pin_salt);
    const failedAttempts = Number(userRow?.transaction_pin_failed_attempts ?? 0);
    const resetRequired = hasPin && (!userRow?.transaction_pin_enabled || failedAttempts >= maxPinAttempts);

    if (!hasPin) {
      return jsonResponse({ success: false, needsSetup: true, resetRequired: false, attemptsRemaining: maxPinAttempts }, 200);
    }

    if (resetRequired) {
      return jsonResponse({
        success: false,
        needsSetup: false,
        resetRequired: true,
        attemptsRemaining: 0,
      }, 200);
    }

    const pinHash = await hashPin(String(pin), userRow.transaction_pin_salt!);
    if (pinHash !== userRow.transaction_pin_hash) {
      const nextAttempts = failedAttempts + 1;
      const lockRequired = nextAttempts >= maxPinAttempts;

      await supabase
        .from("users")
        .update({
          transaction_pin_failed_attempts: nextAttempts,
          transaction_pin_enabled: lockRequired ? false : true,
          transaction_pin_locked_until: lockRequired ? null : userRow.transaction_pin_locked_until ?? null,
        })
        .eq("id", userId);

      return jsonResponse({
        success: false,
        needsSetup: false,
        resetRequired: lockRequired,
        attemptsRemaining: getAttemptsRemaining(nextAttempts),
      }, 200);
    }

    await supabase
      .from("users")
      .update({
        transaction_pin_failed_attempts: 0,
        transaction_pin_locked_until: null,
        transaction_pin_enabled: true,
      })
      .eq("id", userId);

    return jsonResponse({
      success: true,
      needsSetup: false,
      resetRequired: false,
      attemptsRemaining: maxPinAttempts,
    });
  }

  return jsonResponse({ error: "Unsupported action" }, 400);
});
