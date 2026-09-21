# Chat connection settings

Use **Configuration → Chat → Connexion au serveur Chat** to edit the connection
mode and base URL, then click **Enregistrer**. Settings are saved per scope in
`db.scopeConfigs.chatConnection`, following the existing configuration lifecycle.
Only `{mode, baseUrl}` is saved; JWTs and pairing keys are never exported or
synchronized as configuration. **Rétablir les valeurs par défaut** removes the
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
A scope without saved settings uses the organization defaults loaded by the app.
The EDX YAML file is locally ignored by Git in this repository; distribute it
through the existing organization configuration mechanism.

- `jwt`: reads `auth.jwt` for each request and follows refresh/logout. There is
  no fallback to a saved pairing key. The key-entry form is hidden. Identity,
  project and scope headers accompany the Bearer token; null context IDs are
  sent as the literal `null`. The server must use `PWA_AUTH_MODE=jwt` with its
  Krto JWT validation settings.
- `PWA_KEY`: uses the manually entered key from the Chat bar, held in Redux and
  sessionStorage for the current tab. This is the relay's existing `PWA_TOKEN`
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
