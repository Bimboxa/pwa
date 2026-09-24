import { drawingDiagnostics } from "../utils/drawingDiagnostics";
import { useEffect } from "react";
import { useSelector } from "react-redux";

import useAssistantRelayConfig from "../hooks/useAssistantRelayConfig";
import useAssistantRelayToken from "../hooks/useAssistantRelayToken";
import useAssistantRelaySession from "../hooks/useAssistantRelaySession";
import useDetectionJobsRealtime from "../hooks/useDetectionJobsRealtime";
import useApplyLiveDetectionJob from "../hooks/useApplyLiveDetectionJob";
import useVectorizationRunRuntime from "../hooks/useVectorizationRunRuntime";

import ChatSessionProvider from "Features/chat/components/ChatSessionProvider";

function SessionVectorizationRuntime(props) {
  useVectorizationRunRuntime(props);
  return null;
}

const LIVE_MODES = new Set(["live", "live_undo"]);

// Headless runtime of the ChatGPT relay, mounted once with the viewer (panel
// open or not): loads the pairing token, keeps the session and the Realtime
// subscription alive, and applies live jobs (draw / templates / undo) the
// moment they show up in the slice — from Realtime, from the initial fetch or
// from the polling fallback alike.
function AssistantRelayRuntimeInner() {
  useAssistantRelayToken();
  const { connected, refresh } = useAssistantRelaySession();
  useDetectionJobsRealtime({ connected, refresh });
  const jobsById = useSelector((s) => s.assistantRelay.jobsById);
  const { applyLiveJob } = useApplyLiveDetectionJob();
  const connectionStatus = useSelector(
    (s) => s.assistantRelay.connectionStatus
  );
  const transport = useSelector((s) => s.assistantRelay.realtimeTransport);
  const realtime = useSelector((s) => s.assistantRelay.realtimeStatus);
  const code = useSelector((s) => s.assistantRelay.connectionErrorCode);

  useEffect(() => {
    const record = () =>
      drawingDiagnostics.connection({
        status: connectionStatus,
        transport,
        realtime,
        code,
        visibility: document.visibilityState,
        online: navigator.onLine,
      });
    record();
    document.addEventListener("visibilitychange", record);
    window.addEventListener("online", record);
    window.addEventListener("offline", record);
    return () => {
      document.removeEventListener("visibilitychange", record);
      window.removeEventListener("online", record);
      window.removeEventListener("offline", record);
    };
  }, [connectionStatus, transport, realtime, code]);

  useEffect(() => {
    for (const job of Object.values(jobsById ?? {})) {
      if (LIVE_MODES.has(job?.mode))
        drawingDiagnostics.record(job.jobId, "job_observed", {
          status: job.status,
        });
    }
  }, [jobsById]);

  // PDF dropped in the chat: progress stream + base map creation.
  const sessionIds = useSelector((s) => s.chat.sessionIds);

  useEffect(() => {
    if (!connected) return;
    for (const job of Object.values(jobsById ?? {})) {
      if (
        LIVE_MODES.has(job?.mode) &&
        ["proposed", "applying"].includes(job.status)
      ) {
        applyLiveJob(job);
      }
    }
  }, [jobsById, connected, applyLiveJob]);

  // A tab that comes back to the front re-reads the recent jobs: a live job
  // received while hidden was deliberately not applied.
  useEffect(() => {
    if (!connected || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible")
        refresh?.({ background: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [connected, refresh]);

  return sessionIds.map((sessionId) => (
    <ChatSessionProvider key={sessionId} sessionId={sessionId}>
      <SessionVectorizationRuntime connected={connected} refresh={refresh} />
    </ChatSessionProvider>
  ));
}

export default function AssistantRelayRuntime() {
  const config = useAssistantRelayConfig();
  if (!config?.enabled || !config?.relayBaseUrl) return null;
  return <AssistantRelayRuntimeInner />;
}
