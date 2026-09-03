import { getNotesAppClient } from "./notesAppClient";

// Auth flows against the notes-app (Krnet) Supabase backend. Mirrors the
// mobile app's LoginScreen: email OTP (6-digit code) with a domain allowlist
// check, plus a demo-code fallback (8-char code -> magiclink token_hash).

export async function verifyEmailDomain(email) {
  const client = getNotesAppClient();
  const domain = email.trim().toLowerCase().split("@")[1];
  // supabase.functions.invoke treats non-2xx as error — a 403 is the expected
  // answer for a disallowed domain, so any error means "not allowed".
  const { data } = await client.functions.invoke("verify-domain", {
    body: { domain },
  });
  return data?.allowed === true;
}

export async function requestEmailOtp(email) {
  const client = getNotesAppClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

async function claimInvitesBestEffort(client) {
  try {
    await client.rpc("claim_invites");
  } catch (e) {
    console.log("[notesApp] claim_invites failed", e);
  }
}

export async function verifyEmailOtp({ email, token }) {
  const client = getNotesAppClient();
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  await claimInvitesBestEffort(client);
  return data?.session ?? null;
}

export async function loginWithDemoCode(code) {
  const client = getNotesAppClient();
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const { data, error } = await client.functions.invoke("demo-login", {
    body: { code: normalized },
  });
  if (error) throw error;
  if (!data?.ok) {
    const messages = {
      invalid_code: "Code invalide.",
      expired: "Ce code a expiré.",
      revoked: "Ce code a été révoqué.",
      exhausted: "Ce code a atteint sa limite d'utilisations.",
    };
    throw new Error(messages[data?.error] || "Connexion impossible.");
  }
  const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
    token_hash: data.token_hash,
    type: "magiclink",
  });
  if (verifyError) throw verifyError;
  await claimInvitesBestEffort(client);
  return verifyData?.session ?? null;
}

export async function signOutNotesApp() {
  const client = getNotesAppClient();
  await client.auth.signOut();
}

export async function getNotesAppSession() {
  const client = getNotesAppClient();
  const { data } = await client.auth.getSession();
  return data?.session ?? null;
}
