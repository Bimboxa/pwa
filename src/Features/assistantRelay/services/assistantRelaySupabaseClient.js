import { createClient } from "@supabase/supabase-js";

import store from "App/store";

// Lazy singleton Supabase client used ONLY for the Realtime subscription on
// detection_jobs (anon key, no session). Same pattern as notesAppClient.js
// but with its own storageKey so the two features never share a session.

let client = null;
let clientConfigKey = null;

export function getAssistantRelayConfig() {
  return store.getState()?.appConfig?.value?.features?.assistantRelay ?? null;
}

export function hasAssistantRelaySupabaseConfig(config) {
  return Boolean(config?.supabaseUrl && config?.supabaseAnonKey);
}

export function getAssistantRelaySupabaseClient() {
  const config = getAssistantRelayConfig();
  if (!config?.enabled || !hasAssistantRelaySupabaseConfig(config)) {
    throw new Error(
      "assistantRelay Supabase is not configured (appConfig.features.assistantRelay)"
    );
  }
  const configKey = `${config.supabaseUrl}|${config.supabaseAnonKey}`;
  if (client && clientConfigKey === configKey) return client;

  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storageKey: "bimboxa-assistantRelay-auth",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  clientConfigKey = configKey;
  return client;
}

export function resetAssistantRelaySupabaseClient() {
  client = null;
  clientConfigKey = null;
}

// detection_jobs row (snake_case) → DetectionJob DTO (camelCase), the same
// shape the bridge returns.
export function mapDetectionJobRow(row) {
  if (!row?.id) return null;
  return {
    jobId: row.id,
    workspace: row.workspace,
    snapshotId: row.snapshot_id,
    status: row.status,
    annotationCount: row.annotation_count ?? 0,
    templateCount: row.template_count ?? 0,
    createdBy: row.created_by ?? null,
    note: row.note ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
