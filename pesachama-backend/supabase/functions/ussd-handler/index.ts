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

type UserLookupRecord = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  phone_number?: string | null;
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
    { table: "users", phoneColumn: "phone", select: "id, first_name, last_name, phone" },
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
      .select("id, first_name, last_name, phone")
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
          .select("id, first_name, last_name, phone")
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
        .select("id, first_name, last_name, phone")
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

const renderMainMenu = (name: string) =>
  `CON Ratibu\nHi ${name}\n1 Dashboard\n2 Chamas\n3 Accounts\n4 Savings\n5 Meetings\n6 Swaps\n7 Profile\n8 Rewards\n9 Create Chama`;

const renderChamasMenu = () =>
  `CON Ratibu\nChamas\n1 View\n2 Discover\n3 Start\n0 Back\n00 Home`;

const renderAccountsMenu = () =>
  `CON Ratibu\nAccounts\n1 Chama\n2 Savings\n3 Mshwari\n0 Back\n00 Home`;

const renderSavingsMenu = () =>
  `CON Ratibu\nSavings\n1 Plans\n2 New\n3 Lock\n0 Back\n00 Home`;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    console.log(
      `USSD Session ${sessionId} - Phone: ${phoneNumber} - Text: ${text} - Service: ${serviceCode}`,
    );

    let response = "";

    if (!profile) {
      response = "END This phone number is not registered in Ratibu.";
    } else if (text === "") {
      response = `CON Ratibu\nWelcome ${displayName}\n1 Dashboard\n2 Chamas\n3 Accounts\n4 Savings\n5 Meetings\n6 Swaps\n7 Profile\n8 Rewards\n9 Create Chama`;
    } else if (text === "99") {
      response = "END Thank you for using Ratibu.";
    } else {
      const menu = parts;

      if (menu.length === 0) {
        response = renderMainMenu(displayName);
      } else if (menu[0] === "0" || menu[0] === "00") {
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

          response = `END Ratibu\nDashboard\nChamas ${chamaCount}\nSavings ${savingsCount ?? 0}\nMeetings ${meetingCount ?? 0}`;
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
            .join(", ") || "No active chamas";
          response = `END Ratibu\nMy Chamas\n${chamaNames}\nTotal ${memberRows.length}`;
        } else if (menu[1] === "2") {
          response = "END Ratibu\nDiscover Chamas\nOpen the app to browse and join chamas.";
        } else if (menu[1] === "3") {
          response = "END Ratibu\nCreate Chama\nOpen the app to start a new chama.";
        } else {
          response = renderMainMenu(displayName);
        }
      } else if (menu[0] === "3") {
        if (menu.length === 1) {
          response = renderAccountsMenu();
        } else if (menu[1] === "1") {
          const chamas = profile?.id ? await fetchChamaNames(supabase, profile.id) : [];
          const names = chamas
            .map((row) => {
              const relation = row.chamas ?? row.groups;
              return Array.isArray(relation) ? relation[0]?.name : relation?.name;
            })
            .filter(Boolean)
            .join(", ") || "No active chama";
          response = `END Ratibu\nChama Accounts\n${names}`;
        } else if (menu[1] === "2") {
          const { data: savingsTargets, count } = profile?.id
            ? await fetchSavingsTargets(supabase, profile.id)
            : { data: [], count: 0 };
          const summary = (savingsTargets as Array<{ name: string; current_amount: number; target_amount: number }>)
            .slice(0, 2)
            .map((target) => `${target.name}: KES ${Number(target.current_amount || 0).toLocaleString()} / KES ${Number(target.target_amount || 0).toLocaleString()}`)
            .join("\n") || "No active savings plans";
          response = `END Ratibu\nSavings Accounts\n${summary}\nPlans ${count}`;
        } else if (menu[1] === "3") {
          response = "END Ratibu\nMshwari\nManage Mshwari in the app under Accounts.";
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
          response = `END Ratibu\nPersonal Savings\n${summary}\nPlans ${count}`;
        } else if (menu[1] === "2") {
          response = "END Ratibu\nPersonal Savings\nCreate savings plans in the app.";
        } else if (menu[1] === "3") {
          response = "END Ratibu\nLock Savings\nManage locked savings in the app.";
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
            response = "END Ratibu\nUpcoming Meetings\nJoin a chama first.";
          } else {
            const meeting = await fetchUpcomingMeeting(supabase, chamaId);
            if (meeting) {
              const scheduledAt = meeting.date || meeting.scheduled_at || "";
              const date = new Date(scheduledAt).toLocaleDateString();
              const time = new Date(scheduledAt).toLocaleTimeString();
              response = `END Ratibu\nUpcoming Meeting\n${meeting.title || "Meeting"}\n${date} ${time}\n${meeting.agenda || "General"}`;
            } else {
              response = "END Ratibu\nUpcoming Meetings\nNo upcoming meetings.";
            }
          }
        } else if (menu[1] === "2") {
          response = "END Ratibu\nSchedule meetings in the app.";
        } else if (menu[1] === "3") {
          response = "END Ratibu\nRatibu Meet\nJoin virtual meetings in the app.";
        } else {
          response = renderMainMenu(displayName);
        }
      } else if (menu[0] === "6") {
        if (menu.length === 1) {
          response = renderSwapsMenu();
        } else if (menu[1] === "1") {
          response = "END Ratibu\nRequest Swap\nManage swaps in the app.";
        } else if (menu[1] === "2") {
          response = "END Ratibu\nMy Swaps\nView your swaps in the app.";
        } else {
          response = renderMainMenu(displayName);
        }
      } else if (menu[0] === "7") {
        if (menu.length === 1) {
          response = renderProfileMenu();
        } else if (menu[1] === "1") {
          response = `END Ratibu\nProfile\n${displayName}\n${profile?.phone_number || phoneNumber}`;
        } else if (menu[1] === "2") {
          response = "END Ratibu\nEdit Profile\nUpdate your details in the app.";
        } else if (menu[1] === "3") {
          response = "END Ratibu\nKYC\nComplete verification in the app.";
        } else {
          response = renderMainMenu(displayName);
        }
      } else if (menu[0] === "8") {
        if (menu.length === 1) {
          response = renderRewardsMenu();
        } else if (menu[1] === "1") {
          response = "END Ratibu\nRewards\nRewards summary in the app.";
        } else if (menu[1] === "2") {
          response = "END Ratibu\nLeaderboard\nOpen the app to view the leaderboard.";
        } else {
          response = renderMainMenu(displayName);
        }
      } else if (menu[0] === "9") {
        if (menu.length === 1) {
          response = renderCreateChamaMenu();
        } else if (menu[1] === "1") {
          response = "END Ratibu\nCreate Chama\nOpen the app to complete setup.";
        } else if (menu[1] === "2") {
          response = "END Ratibu\nExplore Chamas\nOpen the app to browse chamas.";
        } else {
          response = renderMainMenu(displayName);
        }
      } else {
        response = renderMainMenu(displayName);
      }
    }

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
