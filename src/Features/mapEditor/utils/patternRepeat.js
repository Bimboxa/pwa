// « Répétition du motif » — while a click-drawn path is in progress (2D and
// 3D editors), typing `*<N>` repeats the pattern just drawn N more times
// (same grammar as the copy count of « Déplacer », copyBuffer.js):
//   "*"   → 1 repetition (preview right away)
//   "*3"  → 3 repetitions: copy k (1..3) = pattern translated by k × delta,
//           delta = last pattern point − first pattern point
// The next click (or Enter) appends the repeated points; the drawing goes on.
//
// The pattern runs from the last repetition anchor (the last point appended
// by a previous repetition, tagged `patternAnchor`) — or from the first
// point — to the last point. When nothing was drawn since the anchor, the
// previous pattern (`motifLength` segments) is repeated again. The tags live
// in the points themselves, so erasing a point or resetting the drawing
// needs no extra state.
//
// Works on 2D pixel points {x, y} and 3D world vertices {x, y, z}.
//
// Plain ESM (no path aliases) so the node tests can load it.

import { MAX_COPIES } from "../../annotationTransform/utils/copyBuffer.js";

const DIGIT_RE = /^[0-9]$/;

// A pattern whose end lands back on its start (closed loop) would stack its
// copies on itself: refused.
const MIN_DELTA = 1e-6;

// Snap links of a drawn point (shared vertex, segment insertion, 3D mesh
// pick) — a repeated copy is an independent point, they are dropped.
const LINK_KEYS = [
  "existingPointId",
  "snapSegment",
  "meshKey",
  "nodeId",
  "faceNormal",
  "patternAnchor",
  "motifLength",
];

// Next buffer after `key`, or the same buffer when the key is not accepted:
// `*` (re)starts the buffer, digits then feed the count.
export function appendToPatternRepeatBuffer(buffer, key) {
  const current = buffer ?? "";
  if (key === "*") return "*";
  if (!current.startsWith("*") || !DIGIT_RE.test(key)) return current;
  const next = current.slice(1) + key;
  if (Number(next) > MAX_COPIES) return current;
  return `*${next}`;
}

// Number of repetitions the buffer asks for: "*" → 1, "*3" → 3, 0 when none
// / "*0".
export function parsePatternRepeatCount(buffer) {
  if (!buffer?.startsWith("*")) return 0;
  const countPart = buffer.slice(1);
  if (countPart === "") return 1;
  const n = Number(countPart);
  if (!Number.isInteger(n) || n < 1) return 0;
  return Math.min(n, MAX_COPIES);
}

function getDelta(a, b) {
  const is3d = Number.isFinite(a.z) && Number.isFinite(b.z);
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    ...(is3d ? { z: b.z - a.z } : {}),
  };
}

function getDeltaLength(delta) {
  return Math.hypot(delta.x, delta.y, delta.z ?? 0);
}

// Pattern to repeat → { motif, delta } (motif = the pattern points, first
// to last), or null when there is none (< 2 points) or it is closed.
export function resolvePatternMotif(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const lastIndex = points.length - 1;

  let anchorIndex = 0;
  for (let i = lastIndex; i >= 0; i--) {
    if (points[i]?.patternAnchor) {
      anchorIndex = i;
      break;
    }
  }

  let startIndex = anchorIndex;
  if (anchorIndex === lastIndex) {
    // Nothing drawn since the last repetition: repeat that pattern again.
    const motifLength = points[anchorIndex].motifLength;
    if (!(motifLength >= 1) || lastIndex - motifLength < 0) return null;
    startIndex = lastIndex - motifLength;
  }

  const motif = points.slice(startIndex);
  if (motif.length < 2) return null;
  const delta = getDelta(motif[0], motif[motif.length - 1]);
  if (getDeltaLength(delta) < MIN_DELTA) return null;
  return { motif, delta };
}

function toRepeatedPoint(point, delta, k) {
  const copy = { ...point };
  LINK_KEYS.forEach((key) => delete copy[key]);
  copy.x = point.x + k * delta.x;
  copy.y = point.y + k * delta.y;
  if (Number.isFinite(delta.z) && Number.isFinite(point.z)) {
    copy.z = point.z + k * delta.z;
  }
  return copy;
}

// Points to append to `points` for `count` repetitions of the pattern ([]
// when nothing repeats). The last one carries the anchor tag of the next
// pattern.
export function repeatDrawingPattern(points, count) {
  const resolved = resolvePatternMotif(points);
  if (!resolved || !(count >= 1)) return [];
  const { motif, delta } = resolved;
  const segmentCount = motif.length - 1;

  const repeated = [];
  for (let k = 1; k <= count; k++) {
    for (let i = 1; i < motif.length; i++) {
      repeated.push(toRepeatedPoint(motif[i], delta, k));
    }
  }
  const last = repeated[repeated.length - 1];
  repeated[repeated.length - 1] = {
    ...last,
    patternAnchor: true,
    motifLength: segmentCount,
  };
  return repeated;
}

// Segment count of the pattern a `*N` would repeat (0 when none) — helper
// card display.
export function getPatternSegmentCount(points) {
  const resolved = resolvePatternMotif(points);
  return resolved ? resolved.motif.length - 1 : 0;
}
