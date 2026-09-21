import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectRelayConnectionMode,
  selectRelayBaseUrl,
  selectRelayToken,
  selectRelayIdentityHeaders,
  selectRelayContextKey,
  normalizeRelayBaseUrl,
} from "./relayConnection.js";

const makeState = () => ({
  appConfig: {
    value: {
      features: {
        chat: { connection: { mode: "jwt", baseUrl: "https://chat.example" } },
        assistantRelay: { relayBaseUrl: "https://legacy.example" },
      },
    },
  },
  auth: {
    jwt: "user-jwt",
    token: "unrelated-token",
    userProfile: { idMaster: 73, trigram: "AbC" },
  },
  assistantRelay: { token: "manual-pwa-key" },
  projects: { selectedProjectId: "project-1" },
  scopes: { selectedScopeId: "scope-1" },
  scopeConfig: { itemsByScopeId: {} },
});

test("organization defaults initialize mode/URL; saved tool settings take precedence", () => {
  const state = makeState();
  assert.equal(selectRelayConnectionMode(state), "jwt");
  assert.equal(selectRelayBaseUrl(state), "https://chat.example");
  state.scopeConfig.itemsByScopeId["scope-1"] = {
    chatConnection: { mode: "PWA_KEY", baseUrl: "https://custom.example" },
  };
  assert.equal(selectRelayConnectionMode(state), "PWA_KEY");
  assert.equal(selectRelayBaseUrl(state), "https://custom.example");
  state.appConfig.value.features.chat.connection.baseUrl =
    "https://new-default.example";
  assert.equal(selectRelayBaseUrl(state), "https://custom.example");
  // Reset uses the current organization defaults again.
  state.scopeConfig.itemsByScopeId["scope-1"].chatConnection = null;
  assert.equal(selectRelayBaseUrl(state), "https://new-default.example");
  assert.equal(selectRelayConnectionMode(state), "jwt");
});

test("JWT never falls back to a stored PWA key and follows token refresh/logout", () => {
  const state = makeState();
  assert.equal(selectRelayToken(state), "user-jwt");
  state.auth.jwt = "refreshed-jwt";
  assert.equal(selectRelayToken(state), "refreshed-jwt");
  state.auth.jwt = null;
  assert.equal(selectRelayToken(state), null);
  state.appConfig.value.features.chat.connection.mode = "PWA_KEY";
  assert.equal(selectRelayToken(state), "manual-pwa-key");
  state.appConfig.value.features.chat.connection.mode = "unknown";
  assert.equal(selectRelayToken(state), null);
});

test("legacy organizations keep the manual key and previous relay endpoint", () => {
  const state = makeState();
  delete state.appConfig.value.features.chat;
  assert.equal(selectRelayConnectionMode(state), "PWA_KEY");
  assert.equal(selectRelayToken(state), "manual-pwa-key");
  assert.equal(selectRelayBaseUrl(state), "https://legacy.example");
});

test("JWT headers include identity and project/scope, including explicit null context", () => {
  const state = makeState();
  assert.deepEqual(selectRelayIdentityHeaders(state), {
    "X-User-Id-Master": "73",
    "X-Trigram": "AbC",
    "X-Project-Id": "project-1",
    "X-Scope-Id": "scope-1",
  });
  state.projects.selectedProjectId = null;
  state.scopes.selectedScopeId = null;
  assert.equal(selectRelayIdentityHeaders(state)["X-Project-Id"], "null");
  assert.equal(selectRelayIdentityHeaders(state)["X-Scope-Id"], "null");
});

test("context keys isolate saved endpoints/users/scopes without including credentials", () => {
  const state = makeState();
  const key = selectRelayContextKey(state);
  assert.ok(!key.includes("user-jwt"));
  assert.ok(!key.includes("manual-pwa-key"));
  state.auth.jwt = "refreshed";
  assert.equal(selectRelayContextKey(state), key);
  state.scopes.selectedScopeId = "scope-2";
  assert.notEqual(selectRelayContextKey(state), key);
  state.scopeConfig.itemsByScopeId["scope-2"] = {
    chatConnection: { baseUrl: "https://other.example" },
  };
  assert.equal(selectRelayBaseUrl(state), "https://other.example");
});

test("base URL normalization rejects credentials/query/fragment and unsafe schemes", () => {
  assert.equal(
    normalizeRelayBaseUrl(" https://chat.example/relay/ "),
    "https://chat.example/relay"
  );
  assert.equal(
    normalizeRelayBaseUrl("http://localhost:3002"),
    "http://localhost:3002"
  );
  for (const url of [
    "javascript:alert(1)",
    "https://name:password@example.com",
    "https://example.com?token=abc",
    "https://example.com#token",
    "invalid",
  ]) {
    assert.throws(() => normalizeRelayBaseUrl(url));
  }
});
