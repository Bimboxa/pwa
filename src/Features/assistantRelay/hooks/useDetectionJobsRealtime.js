import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayRealtimeStatus,
  upsertAssistantRelayJobs,
} from "../assistantRelaySlice";

import useAssistantRelayConfig from "./useAssistantRelayConfig";
import {
  getAssistantRelaySupabaseClient,
  hasAssistantRelaySupabaseConfig,
  mapDetectionJobRow,
} from "../services/assistantRelaySupabaseClient";

const POLL_INTERVAL_MS = 10000;

// Live updates of detection_jobs while the panel is open and the relay is
// connected. Supabase Realtime (postgres_changes) when configured; otherwise
// a light polling fallback through the bridge (`refresh`).
export default function useDetectionJobsRealtime({ connected, refresh }) {
  const dispatch = useDispatch();
  const config = useAssistantRelayConfig();

  const workspace = config?.workspace || "main";
  const hasSupabase = hasAssistantRelaySupabaseConfig(config);
  const realtimeStatus = useSelector((s) => s.assistantRelay.realtimeStatus);

  useEffect(() => {
    if (!connected) return;

    if (!hasSupabase) {
      dispatch(setAssistantRelayRealtimeStatus("unavailable"));
      const id = setInterval(
        () => refresh?.({ background: true }),
        POLL_INTERVAL_MS
      );
      return () => clearInterval(id);
    }

    let client;
    let channel;
    try {
      client = getAssistantRelaySupabaseClient();
      channel = client
        .channel(`detection_jobs:${workspace}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "detection_jobs",
            filter: `workspace=eq.${workspace}`,
          },
          (payload) => {
            const job = mapDetectionJobRow(payload?.new);
            if (job) dispatch(upsertAssistantRelayJobs([job]));
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            dispatch(setAssistantRelayRealtimeStatus("subscribed"));
            // Fill any gap between the initial fetch and the subscription.
            refresh?.({ background: true });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            dispatch(setAssistantRelayRealtimeStatus("error"));
          }
        });
    } catch (e) {
      console.log("[assistantRelay] realtime subscription failed", e);
      dispatch(setAssistantRelayRealtimeStatus("error"));
    }

    return () => {
      if (client && channel) client.removeChannel(channel);
      dispatch(setAssistantRelayRealtimeStatus("idle"));
    };
  }, [
    connected,
    hasSupabase,
    workspace,
    config?.supabaseUrl,
    config?.supabaseAnonKey,
    refresh,
    dispatch,
  ]);

  return { realtimeStatus };
}
