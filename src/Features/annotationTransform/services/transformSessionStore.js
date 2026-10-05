import { useSyncExternalStore } from "react";

import { parseAngleBufferToPixelDeg } from "../utils/rotateAngle";

// Session state of the 2D « Déplacer » / « Tourner » tools — a plain module
// store (same model as the 3D tools' session stores), read through
// useSyncExternalStore: the cursor updates re-render only the preview layer
// and the helper, never the whole InteractionLayer tree.
//
// All positions are in the base map's pixel frame (resolved points).
//   kind: "MOVE" | "ROTATE" | null — null: nothing grabbed
//   carriedAnnotationIds
//   anchor: MOVE = grabbed point, ROTATE = pivot
//   reference: ROTATE = point fixing the reference axis (null before 2/3)
//   cursor: last cursor position (snapped when a snap is active)
//   angleDeg: ROTATE = current pixel-space angle (y down: clockwise positive)
//   angleBuffer: ROTATE = typed angle (user degrees), "" when mouse-driven
//   committing: the write is in flight — the preview stays until the
//     annotations come back from the db
const EMPTY = Object.freeze({
  kind: null,
  carriedAnnotationIds: [],
  anchor: null,
  reference: null,
  cursor: null,
  angleDeg: 0,
  angleBuffer: "",
  committing: false,
});

let state = EMPTY;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function getTransformSession() {
  return state;
}

export function setTransformSession(patch) {
  state = { ...state, ...patch };
  emit();
}

export function resetTransformSession() {
  if (state === EMPTY) return;
  state = EMPTY;
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTransformSession() {
  return useSyncExternalStore(subscribe, getTransformSession);
}

// The carried annotations no longer offer snap targets once they follow the
// cursor (MOVE destination, ROTATE 3/3). During ROTATE 2/3 they still do: the
// reference axis is typically one of their own edges.
export function getSnapExcludedAnnotationIds(session) {
  if (session.kind === "MOVE") return session.carriedAnnotationIds;
  if (session.kind === "ROTATE" && session.reference)
    return session.carriedAnnotationIds;
  return [];
}

// ROTATE 3/3 — typed angle (keyboard buffer or the helper's field): the pose
// follows the typed value as soon as it parses.
export function setRotateAngleBuffer(angleBuffer) {
  if (state.kind !== "ROTATE" || !state.reference || state.committing) return;
  const angleDeg = parseAngleBufferToPixelDeg(angleBuffer);
  setTransformSession({
    angleBuffer,
    ...(angleDeg != null ? { angleDeg } : {}),
  });
}
