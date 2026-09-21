import store from "App/store";
import {
  selectRelayToken,
  selectRelayContextKey,
} from "../utils/relayConnection.js";
import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayConnection,
  setAssistantRelaySessionKey,
  setAssistantRelayTransport,
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
  const token = useSelector(selectRelayToken);
  const contextKey = useSelector(selectRelayContextKey);
  const sessionKey = useSelector((s) => s.assistantRelay.sessionKey);
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const connectionError = useSelector((s) => s.assistantRelay.connectionError);

  const relayBaseUrl = config?.relayBaseUrl;
  const enabled = Boolean(config?.enabled && relayBaseUrl && token);

  const refresh = useCallback(
    async ({ background = false } = {}) => {
      if (!enabled) return;
      const isCurrent = () =>
        selectRelayContextKey(store.getState()) === contextKey &&
        selectRelayToken(store.getState()) === token;
      // Background resync must keep the active Realtime subscription mounted.
      if (!background) {
        dispatch(setAssistantRelayConnection({ status: "checking" }));
      }
      try {
        const [session, jobs, baseMapJobs] = await Promise.all([
          fetchRelaySession(),
          fetchRecentJobs(30),
          fetchBaseMapJobs(30),
        ]);
        if (!isCurrent()) return;
        dispatch(
          setAssistantRelayTransport(
            session?.realtime?.enabled === false
              ? "bridge-polling"
              : (session?.realtime?.transport ?? null)
          )
        );
        dispatch(setAssistantRelaySnapshot(session?.currentSnapshot ?? null));
        dispatch(upsertAssistantRelayJobs(jobs));
        dispatch(upsertAssistantRelayBaseMapJobs(baseMapJobs));
        dispatch(
          setAssistantRelayConnection({
            status: "connected",
            jwtVerificationSkipped:
              session?.authentication?.jwtVerificationSkipped === true,
          })
        );
      } catch (e) {
        if (!isCurrent()) return;
        console.log("[assistantRelay] session check failed", e);
        // Keep reconnection/polling mounted through transient background errors.
        if (background && e?.status !== 401 && e?.status !== 403) return;
        dispatch(
          setAssistantRelayConnection({
            status: "error",
            error: describeRelayError(e),
            code: e?.code ?? null,
          })
        );
      }
    },
    [enabled, relayBaseUrl, token, contextKey, dispatch]
  );

  useEffect(() => {
    dispatch(setAssistantRelaySessionKey(enabled ? contextKey : null));
    if (!enabled) {
      dispatch(setAssistantRelayConnection({ status: "idle" }));
      return;
    }
    refresh();
  }, [enabled, contextKey, refresh, dispatch]);

  return {
    enabled,
    connected:
      enabled && sessionKey === contextKey && connectionStatus === "connected",
    connectionStatus,
    connectionError,
    refresh,
  };
}
