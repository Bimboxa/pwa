import { createClient } from "@supabase/supabase-js";

import store from "App/store";

// Lazy singleton Supabase client for the notes-app (Krnet) backend.
// Config (url + publishable key) comes from appConfig.features.notesApp:
// the feature is org-gated there, no env var involved. The session lives in
// localStorage under its own storageKey — a separate identity from the
// Bimboxa auth (authSlice).

let client = null;
let clientConfigKey = null;

export function getNotesAppConfig() {
  return store.getState()?.appConfig?.value?.features?.notesApp ?? null;
}

export function getNotesAppClient() {
  const config = getNotesAppConfig();
  if (!config?.enabled || !config?.supabaseUrl || !config?.supabaseAnonKey) {
    throw new Error(
      "notesApp feature is not configured (appConfig.features.notesApp)"
    );
  }
  const configKey = `${config.supabaseUrl}|${config.supabaseAnonKey}`;
  if (client && clientConfigKey === configKey) return client;

  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storageKey: "bimboxa-notesApp-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  clientConfigKey = configKey;
  return client;
}

export function resetNotesAppClient() {
  client = null;
  clientConfigKey = null;
}
