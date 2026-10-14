import { useSyncExternalStore } from "react";

import { parseAngleBufferToPixelDeg } from "../utils/rotateAngle";
import {
  getBufferValuePart,
  parseCopyCount,
  parseMoveLength,
  scaleDeltaToLength,
  withDefaultCopyCount,
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
//   angleBuffer: ROTATE = typed `<angle>[*<copies>]` buffer ("45*3", user
//     degrees), "" when mouse-driven without copies (see utils/copyBuffer)
//   copyBuffer: MOVE = typed `<distance>[*<copies>]` buffer ("1.3*3"), ""
//     = plain move (see utils/copyBuffer). It may be typed BEFORE the grab
//     (kind null, « Déplacer » armed): the next grab picks it up.
//   copiesRefused: MOVE = the carried annotation is never copied (revolution
//     axis, disc) — the `*N` tail is dropped
//   repeat: MOVE « Recommencer à chaque clic » (R) — survives the grabs and
//     the commits, dropped when the tool is left (resetTransformTool)
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
  copiesRefused: false,
  repeat: false,
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

// Same, with « Recommencer à chaque clic » on (a stable snapshot for
// useSyncExternalStore).
const EMPTY_REPEAT = Object.freeze({ ...EMPTY, repeat: true });

// Drops the grab (cancel, commit done, no-op click): the tool stays armed,
// « Recommencer à chaque clic » is kept.
export function resetTransformSession() {
  const next = state.repeat ? EMPTY_REPEAT : EMPTY;
  if (state === next) return;
  state = next;
  emit();
}

// Leaving the tool (Escape, another tool, module switch): everything goes,
// the repeat option included.
export function resetTransformTool() {
  if (state === EMPTY) return;
  state = EMPTY;
  emit();
}

// « Recommencer à chaque clic » (R / the helper's switch) — MOVE only.
export function setTransformRepeat(repeat) {
  const next = Boolean(repeat);
  if (state.repeat === next) return;
  setTransformSession({ repeat: next });
}

export function toggleTransformRepeat() {
  setTransformRepeat(!state.repeat);
}

// « Copier » (C / the helper's button): one copy per click unless copies
// are already typed, and « Recommencer à chaque clic » on. Armed or
// carrying; a no-op on an annotation that is never copied.
export function armMoveCopy() {
  if (state.kind === "ROTATE" || state.committing) return;
  if (state.copiesRefused) return;
  setMoveCopyBuffer(withDefaultCopyCount(state.copyBuffer));
  setTransformRepeat(true);
}

// End of a commit (the annotations came back from the db, or the fallback
// timer): the grab is dropped — unless « Recommencer à chaque clic »:
// with copies the grab survives as is (the originals never moved, the
// anchor is still theirs); without, the moved annotations are grabbed again
// at the destination (the last cursor), the typed buffer kept.
export function endTransformCommit() {
  if (!state.committing) return;
  if (state.kind === "MOVE" && state.repeat) {
    if (getTransformCopyCount() > 0) {
      setTransformSession({ committing: false });
      return;
    }
    const anchor = state.cursor ?? state.anchor;
    setTransformSession({
      committing: false,
      anchor,
      cursor: anchor,
      rawCursor: anchor,
    });
    return;
  }
  resetTransformSession();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTransformSession() {
  return useSyncExternalStore(subscribe, getTransformSession);
}

// Number of copies the session asks for (0 = plain move / turn): the `*N`
// tail of the MOVE buffer or of the ROTATE angle buffer.
export function getTransformCopyCount(session = state) {
  if (session.kind === "MOVE") return parseCopyCount(session.copyBuffer);
  if (session.kind === "ROTATE") return parseCopyCount(session.angleBuffer);
  return 0;
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
// (2/3) | "ROTATE_TURN" (3/3) | "ROTATE_COPY" (3/3 with typed copies — the
// originals stay in place, visible and snappable).
function getTransformPhase() {
  if (state.kind === "MOVE")
    return getTransformCopyCount() > 0 ? "MOVE_COPY" : "MOVE";
  if (state.kind === "ROTATE") {
    if (!state.reference) return "ROTATE_REFERENCE";
    return getTransformCopyCount() > 0 ? "ROTATE_COPY" : "ROTATE_TURN";
  }
  return "IDLE";
}

export function useTransformPhase() {
  return useSyncExternalStore(subscribe, getTransformPhase);
}

// ROTATE 3/3 — typed `<angle>[*<copies>]` buffer (keyboard or the helper's
// field): the pose follows the typed angle as soon as it parses; the copy
// count is read from the `*N` tail (getTransformCopyCount).
export function setRotateAngleBuffer(angleBuffer) {
  if (state.kind !== "ROTATE" || !state.reference || state.committing) return;
  const angleDeg = parseAngleBufferToPixelDeg(angleBuffer);
  setTransformSession({
    angleBuffer,
    ...(angleDeg != null ? { angleDeg } : {}),
  });
}

// MOVE — typed `<distance>[*<copies>]` buffer (keyboard or the helper's
// fields): while carrying (the destination follows the new distance at
// once), or before the grab (« Déplacer » armed: the next grab picks it
// up). Ignored while turning or writing; the `*N` tail is dropped on an
// annotation that is never copied.
export function setMoveCopyBuffer(copyBuffer) {
  if (state.kind === "ROTATE" || state.committing) return;
  const buffer = state.copiesRefused
    ? getBufferValuePart(copyBuffer ?? "")
    : (copyBuffer ?? "");
  if (state.kind !== "MOVE") {
    if (buffer !== state.copyBuffer)
      setTransformSession({ copyBuffer: buffer });
    return;
  }
  const next = { ...state, copyBuffer: buffer };
  setTransformSession({
    copyBuffer: buffer,
    cursor: constrainMoveCursor(next, state.rawCursor ?? state.cursor),
  });
}
