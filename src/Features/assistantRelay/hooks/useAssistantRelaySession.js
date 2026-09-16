import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayConnection,
  setAssistantRelaySnapshot,
  upsertAssistantRelayBaseMapJobs,
  upsertAssistantRelayJobs,
} from "../assistantRelaySlice";

import useAssistantRelayConfig from "./useAssistantRelayConfig";
import {
  describeRelayError,
  fetchBaseMapJobs,
  fetchRecentJobs,
  fetchRelaySession,
} from "../services/assistantRelayClient";

// Checks the relay connection whenever the token / config changes, mirrors
// the current snapshot and the recent jobs into the slice. `refresh` is the
// manual resync (button + Realtime SUBSCRIBED).
export default function useAssistantRelaySession() {
  const dispatch = useDispatch();
  const config = useAssistantRelayConfig();
  const token = useSelector((s) => s.assistantRelay.token);
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const connectionError = useSelector((s) => s.assistantRelay.connectionError);

  const relayBaseUrl = config?.relayBaseUrl;
  const enabled = Boolean(config?.enabled && relayBaseUrl && token);

  const refresh = useCallback(
    async ({ background = false } = {}) => {
      if (!enabled) return;
      // Background resync must keep the active Realtime subscription mounted.
      if (!background) {
        dispatch(setAssistantRelayConnection({ status: "checking" }));
      }
      try {
        const session = await fetchRelaySession();
        dispatch(setAssistantRelaySnapshot(session?.currentSnapshot ?? null));
        const jobs = await fetchRecentJobs(30);
        dispatch(upsertAssistantRelayJobs(jobs));
        const baseMapJobs = await fetchBaseMapJobs(30);
        dispatch(upsertAssistantRelayBaseMapJobs(baseMapJobs));
        dispatch(setAssistantRelayConnection({ status: "connected" }));
      } catch (e) {
        console.log("[assistantRelay] session check failed", e);
        dispatch(
          setAssistantRelayConnection({
            status: "error",
            error: describeRelayError(e),
          })
        );
      }
    },
    [enabled, relayBaseUrl, token, dispatch]
  );

  useEffect(() => {
    if (!enabled) {
      dispatch(setAssistantRelayConnection({ status: "idle" }));
      return;
    }
    refresh();
  }, [enabled, refresh, dispatch]);

  return {
    enabled,
    connected: connectionStatus === "connected",
    connectionStatus,
    connectionError,
    refresh,
  };
}
