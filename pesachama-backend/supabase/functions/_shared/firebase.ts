import { importPKCS8, SignJWT } from "https://esm.sh/jose@5.9.6";

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type CachedFirebaseToken = {
  accessToken: string;
  expiresAt: number;
  projectId: string;
};

let cachedToken: CachedFirebaseToken | null = null;

function getServiceAccount(): FirebaseServiceAccount {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret");
  }

  const parsed = JSON.parse(raw) as Partial<FirebaseServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid Firebase service account JSON");
  }

  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

async function getAccessToken(): Promise<{ accessToken: string; projectId: string }> {
  const account = getServiceAccount();
  if (cachedToken && cachedToken.projectId === account.project_id && Date.now() < cachedToken.expiresAt - 60_000) {
    return { accessToken: cachedToken.accessToken, projectId: cachedToken.projectId };
  }

  const privateKey = account.private_key.replace(/\\n/g, "\n");
  const signingKey = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(signingKey);

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResp.ok) {
    const errorText = await tokenResp.text();
    throw new Error(`Failed to generate Firebase access token (${tokenResp.status}): ${errorText}`);
  }

  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token as string | undefined;
  const expiresIn = Number(tokenData.expires_in ?? 3600);

  if (!accessToken) {
    throw new Error("Firebase token response did not include access_token");
  }

  cachedToken = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    projectId: account.project_id,
  };

  return { accessToken, projectId: account.project_id };
}

export async function sendFirebasePush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const { accessToken, projectId } = await getAccessToken();

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firebase push failed (${response.status}): ${errorText}`);
  }
}
