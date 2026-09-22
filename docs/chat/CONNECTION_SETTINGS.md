# Chat connection settings

Use **Configuration → Généralités → Serveur Chat** to pick the connection mode
with the **Production / Debug** toggle (Production = `jwt`, Debug = `PWA_KEY`),
the base URL and, in Debug, the server pairing key, then click **Enregistrer**. This is an app-level (device)
preference, available without a selected scope: it is kept in
`appConfig.chatConnection` (Redux) and persisted in `localStorage`
(`chatConnection` key), loaded by `useInitAppConfig`. It applies to every scope.
Only `{mode, baseUrl}` is saved there; the JWT is never stored and the Debug
pairing key has its own localStorage entry (`pairingKeyStorage.js`).
**Rétablir les valeurs par défaut** removes the
saved override.

Organization defaults live in `appConfig_<org>.yaml`:

```yaml
features:
  chat:
    connection:
      mode: "jwt" # or "PWA_KEY"
      baseUrl: "https://reperage-mcp.onrender.com"
  assistantRelay:
    enabled: true
```

EDX defaults to `jwt`; the default organization uses `PWA_KEY`. For old configs,
an absent connection mode means `PWA_KEY` and the endpoint falls back to
`features.assistantRelay.relayBaseUrl`. Saved settings take precedence over the
organization defaults; changing defaults does not overwrite saved tool settings.
A device without saved settings uses the organization defaults loaded by the app.
Legacy per-scope values (`db.scopeConfigs.chatConnection`) are ignored.
The EDX YAML file is locally ignored by Git in this repository; distribute it
through the existing organization configuration mechanism.

- `jwt`: reads `auth.jwt` for each request and follows refresh/logout. There is
  no fallback to a saved pairing key. The key-entry form is hidden. Identity,
  project and scope headers accompany the Bearer token; null context IDs are
  sent as the literal `null`. The server must use `PWA_AUTH_MODE=jwt` with its
  Krto JWT validation settings.
- `PWA_KEY` (Debug): uses the key entered in Configuration → Serveur Chat (or
  the Chat bar), held in Redux and persisted in localStorage on the device. The
  Chat panel shows a "Debug" strip, and the status tooltip shows the key hint
  (last 4 characters) and the server host instead of the JWT user. This is the relay's existing `PWA_TOKEN`
  credential; the server must use `PWA_AUTH_MODE=shared-token`.

Use the server's base URL, including a deployment prefix if required, but not
`/bridge` or `/chat/turns`. All Chat HTTP, upload/download, budget and SSE calls
share this endpoint and credential selection. HTTPS is expected in production.
Credentials embedded in the URL, query strings, fragments and non-HTTP schemes
are rejected.

Changing endpoint, mode or JWT context restarts the connection and clears old
relay job state. A JWT refresh reconnects the stream using the new token. Late
session refresh results from a previous credential/context are discarded.
JWT mode never opens the legacy anonymous Supabase Realtime subscription.

Tests: `node --test src/Features/assistantRelay/utils/*.test.mjs
src/Features/assistantRelay/services/watchRelayEvents.test.mjs`, then `npm run build`.
