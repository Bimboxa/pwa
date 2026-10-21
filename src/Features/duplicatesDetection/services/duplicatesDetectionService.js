import findOverlappingAnnotations from "../utils/findOverlappingAnnotations";
import { USE_WORKER } from "../constants/duplicatesDetectionConstants";

// Worker lifecycle of the duplicates detection: one worker per run (a new
// run terminates the previous one, so a stale run can never post back),
// terminated as soon as it settles. Falls back to the main thread when
// workers are unavailable (or USE_WORKER is off) — after a macrotask so the
// toolbar spinner gets painted first.

let activeRun = null;

function createWorker() {
  if (!USE_WORKER || typeof Worker === "undefined") return null;
  try {
    return new Worker(
      new URL("../workers/duplicatesDetection.worker.js", import.meta.url),
      { type: "module" }
    );
  } catch (error) {
    console.warn("[duplicatesDetection] worker unavailable:", error);
    return null;
  }
}

function cancelledError() {
  const error = new Error("Duplicates detection cancelled");
  error.cancelled = true;
  return error;
}

export function cancelDuplicatesDetection() {
  activeRun?.cancel();
}

// → { promise, cancel }: the promise resolves with the matcher result, or
// rejects with an error carrying `cancelled: true` when superseded / cleared.
export default function runDuplicatesDetection({
  runId,
  annotations,
  options,
}) {
  cancelDuplicatesDetection();

  const worker = createWorker();
  let settled = false;
  let cancelled = false;
  let cancelRun = () => {};

  const promise = new Promise((resolve, reject) => {
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      worker?.terminate();
      if (activeRun?.runId === runId) activeRun = null;
      settle(value);
    };

    cancelRun = () => {
      cancelled = true;
      finish(reject, cancelledError());
    };

    if (!worker) {
      setTimeout(() => {
        if (cancelled) return;
        try {
          finish(resolve, findOverlappingAnnotations(annotations, options));
        } catch (error) {
          finish(reject, error);
        }
      }, 0);
      return;
    }

    worker.onmessage = ({ data }) => {
      if (data?.runId !== runId) return;
      if (data.type === "RESULT") finish(resolve, data.result);
      else if (data.type === "ERROR")
        finish(
          reject,
          new Error(data.message || "Duplicates detection failed")
        );
    };
    worker.onerror = (event) => {
      finish(
        reject,
        new Error(event?.message || "Duplicates detection worker error")
      );
    };
    worker.postMessage({ type: "DETECT", runId, annotations, options });
  });

  activeRun = { runId, cancel: cancelRun };

  return { promise, cancel: cancelRun };
}
