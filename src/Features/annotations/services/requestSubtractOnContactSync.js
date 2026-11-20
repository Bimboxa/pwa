import store from "App/store";
import { onUndoRedoApplied } from "App/db/undoManager";

import { setToaster } from "Features/layout/layoutSlice";

import syncSubtractOnContactService from "./syncSubtractOnContactService";

// Edits arrive in bursts (a paste writes N rows, a drag commits then
// re-syncs its links): wait for the burst to settle before the 3D test.
const DEBOUNCE_MS = 150;

const pendingIds = new Set();
// The « soustraire au contact » annotations synced during this session: the
// ones an undo / redo may have moved back (the sync writes no undo entry).
const knownCutterIds = new Set();

let timer = null;
let running = false;
let undoListenerRegistered = false;

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  timer = null;
  if (running) {
    // One run at a time: the pending ids are picked up when it ends.
    schedule();
    return;
  }
  if (pendingIds.size === 0) return;
  const annotationIds = [...pendingIds];
  pendingIds.clear();
  running = true;
  try {
    const { addedCount, cutterIds } = await syncSubtractOnContactService({
      annotationIds,
    });
    cutterIds.forEach((id) => knownCutterIds.add(id));
    if (addedCount > 0) {
      store.dispatch(
        setToaster({
          message:
            addedCount === 1
              ? "Soustraite au contact d'1 annotation"
              : `Soustraite au contact de ${addedCount} annotations`,
          severity: "info",
        })
      );
    }
  } catch (error) {
    console.warn("[subtractOnContact] sync failed", error);
  } finally {
    running = false;
    if (pendingIds.size > 0) schedule();
  }
}

function registerUndoListener() {
  if (undoListenerRegistered) return;
  undoListenerRegistered = true;
  onUndoRedoApplied(() => {
    if (knownCutterIds.size === 0) return;
    knownCutterIds.forEach((id) => pendingIds.add(id));
    schedule();
  });
}

/**
 * Asks for a « soustraire au contact » sync of the given annotations (just
 * created, pasted, moved or reshaped). Fire-and-forget, debounced and
 * serialized; a no-op for annotations that do not carry the option (one
 * indexed read). See syncSubtractOnContactService.
 *
 * @param {Array<string>|Set<string>} annotationIds
 */
export default function requestSubtractOnContactSync(annotationIds) {
  let added = false;
  for (const id of annotationIds ?? []) {
    if (!id) continue;
    pendingIds.add(id);
    added = true;
  }
  if (!added) return;
  registerUndoListener();
  schedule();
}
