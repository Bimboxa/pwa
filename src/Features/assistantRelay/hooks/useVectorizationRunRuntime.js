import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  addMessage,
  appendMessageContent,
  setVectorization,
  updateMessageById,
} from "Features/chat/chatSlice";

import useCreateBaseMapFromRelayJob from "./useCreateBaseMapFromRelayJob";
import {
  describeRelayError,
  fetchVectorization,
  streamVectorizationEvents,
} from "../services/assistantRelayClient";
import {
  loadVectorizationPointer,
  saveVectorizationPointer,
} from "../utils/vectorizationPointer";

const FINAL = new Set(["completed", "failed", "cancelled"]);
const RECONNECT_MS = [1000, 2000, 5000, 10000];

// Headless follower of the vectorization run launched from the chat. Lives in
// the relay runtime (not in the chat panel) so that closing the panel neither
// cuts the progress stream nor blocks the import:
//   1. streams the run events into the chat message;
//   2. when the run is `ready`, creates the base map from its base map job —
//      in the project the run was launched from, never elsewhere. The
//      snapshot published right after makes the relay create the live
//      annotations job, which useApplyLiveDetectionJob imports.
export default function useVectorizationRunRuntime({ connected, refresh }) {
  const dispatch = useDispatch();
  const pointer = useSelector((s) => s.chat.vectorization);
  const message = useSelector((s) =>
    pointer ? s.chat.messages.find((m) => m.id === pointer.messageId) : null
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { createFromJob } = useCreateBaseMapFromRelayJob();

  const run = message?.run ?? null;
  const runId = pointer?.runId ?? null;
  const messageId = pointer?.messageId ?? null;

  // After a reload: pick the run of this tab up again.
  useEffect(() => {
    if (!connected || pointer) return;
    const saved = loadVectorizationPointer();
    if (!saved) return;
    let cancelled = false;
    (async () => {
      try {
        const current = await fetchVectorization(saved.runId);
        if (cancelled) return;
        dispatch(
          addMessage({
            id: saved.messageId,
            role: "assistant",
            type: "vectorization",
            content: current.summary ?? "",
            run: current,
          })
        );
        if (FINAL.has(current.status)) saveVectorizationPointer(null);
        else dispatch(setVectorization(saved));
      } catch (e) {
        console.log("[assistantRelay] vectorization restore failed", e);
        if (e?.status === 404) saveVectorizationPointer(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, pointer, dispatch]);

  // 1. Progress stream, reconnected from the last event id it saw.
  useEffect(() => {
    if (!connected || !runId || !messageId) return;
    const controller = new AbortController();
    let after = 0;
    let finished = false;

    const onEvent = (event) => {
      if (typeof event.id === "number") after = event.id;
      if (event.type === "text") {
        dispatch(appendMessageContent({ id: messageId, delta: event.delta }));
      } else if (event.type === "tool") {
        dispatch(
          updateMessageById({
            id: messageId,
            changes: { toolRunning: event.phase === "running" },
          })
        );
      } else if (event.type === "status") {
        const changes = { run: event.run, streamError: null };
        if (event.status !== "analyzing" && event.status !== "queued") {
          changes.toolRunning = false;
        }
        dispatch(updateMessageById({ id: messageId, changes }));
        if (FINAL.has(event.status)) {
          finished = true;
          saveVectorizationPointer(null);
          dispatch(setVectorization(null));
        }
      }
    };

    (async () => {
      for (let attempt = 0; !controller.signal.aborted && !finished; ) {
        try {
          await streamVectorizationEvents(runId, {
            after,
            signal: controller.signal,
            onEvent,
          });
          attempt = 0; // closed cleanly: finished, or an idle proxy cut it
        } catch (e) {
          if (e?.status === 404) {
            saveVectorizationPointer(null);
            dispatch(setVectorization(null));
            return;
          }
          dispatch(
            updateMessageById({
              id: messageId,
              changes: { streamError: describeRelayError(e) },
            })
          );
          attempt++;
        }
        if (finished || controller.signal.aborted) return;
        const delay = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)];
        await new Promise((r) => setTimeout(r, delay));
      }
    })();

    return () => controller.abort();
  }, [connected, runId, messageId, dispatch]);

  // The annotations job was just created on the relay: read the jobs now
  // rather than waiting for Realtime (or for the polling fallback).
  const detectionJobId =
    run?.status === "importing" ? run.detectionJobId : null;
  useEffect(() => {
    if (connected && detectionJobId) refresh?.({ background: true });
  }, [connected, detectionJobId, refresh]);

  // 2. Base map creation, once, in the right project, from a visible tab (a
  // hidden tab waits until it comes back to the front).
  const attempted = useRef(new Set());
  const [visible, setVisible] = useState(
    typeof document === "undefined" || document.visibilityState === "visible"
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  const baseMapJobId = run?.status === "ready" ? run.baseMapJobId : null;
  const targetProjectId = pointer?.target?.projectId ?? null;
  const listingId = pointer?.target?.baseMapListingId ?? undefined;
  const wrongProject = Boolean(
    baseMapJobId && targetProjectId && projectId !== targetProjectId
  );

  useEffect(() => {
    if (!messageId || !baseMapJobId) return;
    dispatch(
      updateMessageById({
        id: messageId,
        changes: { localStep: wrongProject ? "wrong_project" : null },
      })
    );
  }, [messageId, baseMapJobId, wrongProject, dispatch]);

  useEffect(() => {
    if (!connected || !baseMapJobId || !messageId || wrongProject) return;
    if (!visible || attempted.current.has(baseMapJobId)) return;
    attempted.current.add(baseMapJobId);
    (async () => {
      dispatch(
        updateMessageById({
          id: messageId,
          changes: { localStep: "creating_base_map", localError: null },
        })
      );
      const result = await createFromJob(baseMapJobId, { listingId });
      dispatch(
        updateMessageById({
          id: messageId,
          changes: result?.ok
            ? {
                localStep: result.publishError ? "publish_error" : null,
                localError: result.publishError ?? null,
                baseMapId: result.baseMapId,
              }
            : {
                localStep: "base_map_error",
                localError: result?.error ?? null,
              },
        })
      );
    })();
  }, [
    connected,
    baseMapJobId,
    messageId,
    wrongProject,
    visible,
    listingId,
    createFromJob,
    dispatch,
  ]);
}
