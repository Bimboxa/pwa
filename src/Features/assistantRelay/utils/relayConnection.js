import getRelayIdentityHeaders from "./getRelayIdentityHeaders.js";

// Saved per-scope tool settings override organization defaults. Credentials
// never belong in this collaborative configuration record.
export const selectSavedChatConnection = (state) =>
  state.scopeConfig?.itemsByScopeId?.[state.scopes?.selectedScopeId]
    ?.chatConnection;
export const selectRelayConnectionMode = (state) =>
  selectSavedChatConnection(state)?.mode ??
  state.appConfig?.value?.features?.chat?.connection?.mode ??
  "PWA_KEY";
export const selectRelayBaseUrl = (state) =>
  selectSavedChatConnection(state)?.baseUrl ??
  state.appConfig?.value?.features?.chat?.connection?.baseUrl ??
  state.appConfig?.value?.features?.assistantRelay?.relayBaseUrl ??
  "";

export function normalizeRelayBaseUrl(value) {
  const url = new URL(value.trim());
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Utilisez une URL HTTP(S), sans identifiants, paramètres ou fragment."
    );
  }
  return url.href.replace(/\/+$/, "");
}

export function selectRelayToken(state) {
  const mode = selectRelayConnectionMode(state);
  const token =
    mode === "jwt"
      ? state.auth?.jwt
      : mode === "PWA_KEY"
        ? state.assistantRelay?.token
        : null;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export function selectRelayIdentityHeaders(state) {
  const headers = getRelayIdentityHeaders(state.auth?.userProfile);
  return selectRelayConnectionMode(state) === "jwt"
    ? {
        ...headers,
        "X-Project-Id": String(state.projects?.selectedProjectId ?? "null"),
        "X-Scope-Id": String(state.scopes?.selectedScopeId ?? "null"),
      }
    : headers;
}

// No credential in this key. A new user/project must not inherit cached jobs.
export function selectRelayContextKey(state) {
  const relay = state.appConfig?.value?.features?.assistantRelay;
  return JSON.stringify([
    selectRelayConnectionMode(state),
    selectRelayBaseUrl(state),
    relay?.workspace,
    selectRelayConnectionMode(state) === "jwt"
      ? selectRelayIdentityHeaders(state)
      : null,
  ]);
}
