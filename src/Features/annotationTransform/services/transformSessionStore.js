import { useSyncExternalStore } from "react";

import { parseAngleBufferToPixelDeg } from "../utils/rotateAngle";
import {
  parseCopyCount,
  parseMoveLength,
  scaleDeltaToLength,
} from "../utils/copyBuffer";

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
//   cursor: last cursor position (snapped when a snap is active; MOVE with
//     a typed distance: constrained to that distance from the anchor)
//   rawCursor: MOVE = the cursor before the typed-distance constraint
//   meterByPx: MOVE = scale of the base map (typed distance → pixels)
//   angleDeg: ROTATE = current pixel-space angle (y down: clockwise positive)
//   angleBuffer: ROTATE = typed angle (user degrees), "" when mouse-driven
//   copyBuffer: MOVE = typed `<distance>[*<copies>]` buffer ("1.3*3"), ""
//     = plain move (see utils/copyBuffer)
//   committing: the write is in flight — the preview stays until the
//     annotations come back from the db
const EMPTY = Object.freeze({
  kind: null,
  carriedAnnotationIds: [],
  anchor: null,
  reference: null,
  cursor: null,
  rawCursor: null,
  meterByPx: null,
  angleDeg: 0,
  angleBuffer: "",
  copyBuffer: "",
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

// Number of copies the MOVE session asks for (0 = plain move).
export function getTransformCopyCount(session = state) {
  return session.kind === "MOVE" ? parseCopyCount(session.copyBuffer) : 0;
}

// Typed distance of the MOVE session (metres), or null.
export function getTransformMoveLength(session = state) {
  return session.kind === "MOVE" ? parseMoveLength(session.copyBuffer) : null;
}

// MOVE — the destination for a raw (snapped / locked) cursor: the typed
// distance, when any, rescales the anchor → cursor vector (pixels).
export function constrainMoveCursor(session, rawCursor) {
  if (!rawCursor || !session.anchor) return rawCursor;
  const lengthM = getTransformMoveLength(session);
  if (!(lengthM > 0) || !(session.meterByPx > 0)) return rawCursor;
  const delta = scaleDeltaToLength(
    { x: rawCursor.x - session.anchor.x, y: rawCursor.y - session.anchor.y },
    lengthM / session.meterByPx
  );
  return { x: session.anchor.x + delta.x, y: session.anchor.y + delta.y };
}

// MOVE — sets the raw cursor and derives the constrained one.
export function setMoveCursor(rawCursor) {
  setTransformSession({
    rawCursor,
    cursor: constrainMoveCursor(state, rawCursor),
  });
}

// Coarse phase of the session, for subscribers that must NOT re-render on
// every cursor move (InteractionLayer): "IDLE" (nothing grabbed) | "MOVE"
// (destination pending) | "MOVE_COPY" (destination of the 1st copy pending —
// the originals stay in place, visible and snappable) | "ROTATE_REFERENCE"
// (2/3) | "ROTATE_TURN" (3/3).
function getTransformPhase() {
  if (state.kind === "MOVE")
    return getTransformCopyCount() > 0 ? "MOVE_COPY" : "MOVE";
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

// MOVE — typed `<distance>[*<copies>]` buffer (keyboard). Ignored outside a
// pending move. The destination follows the new distance at once.
export function setMoveCopyBuffer(copyBuffer) {
  if (state.kind !== "MOVE" || state.committing) return;
  const next = { ...state, copyBuffer };
  setTransformSession({
    copyBuffer,
    cursor: constrainMoveCursor(next, state.rawCursor ?? state.cursor),
  });
}
