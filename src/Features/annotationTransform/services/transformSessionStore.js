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

// Coarse phase of the session, for subscribers that must NOT re-render on
// every cursor move (InteractionLayer): "IDLE" (nothing grabbed) | "MOVE"
// (destination pending) | "ROTATE_REFERENCE" (2/3) | "ROTATE_TURN" (3/3).
function getTransformPhase() {
  if (state.kind === "MOVE") return "MOVE";
  if (state.kind === "ROTATE")
    return state.reference ? "ROTATE_TURN" : "ROTATE_REFERENCE";
  return "IDLE";
}

export function useTransformPhase() {
  return useSyncExternalStore(subscribe, getTransformPhase);
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
