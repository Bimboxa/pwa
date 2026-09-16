import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayConnection,
  setAssistantRelaySnapshot,
  upsertAssistantRelayJobs,
} from "../assistantRelaySlice";

import useAssistantRelayConfig from "./useAssistantRelayConfig";
import {
  describeRelayError,
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

  const enabled = Boolean(config?.enabled && config?.relayBaseUrl && token);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    dispatch(setAssistantRelayConnection({ status: "checking" }));
    try {
      const session = await fetchRelaySession();
      dispatch(setAssistantRelaySnapshot(session?.currentSnapshot ?? null));
      const jobs = await fetchRecentJobs(30);
      dispatch(upsertAssistantRelayJobs(jobs));
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
  }, [enabled, dispatch]);

  useEffect(() => {
    if (!enabled) {
      dispatch(setAssistantRelayConnection({ status: "idle" }));
      return;
    }
    refresh();
  }, [enabled, config?.relayBaseUrl, token]);

  return {
    enabled,
    connected: connectionStatus === "connected",
    connectionStatus,
    connectionError,
    refresh,
  };
}
