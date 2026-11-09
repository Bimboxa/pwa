import {
  isExactArcTriplet,
  relocateArcControl,
} from "Features/geometry/utils/arcChordSagitta";

import computeSegmentLengthEdit from "./computeSegmentLengthEdit";

// Arc-aware front of computeSegmentLengthEdit.
//
// The solver only knows straight segments. Here every exact S-C-S arc is
// collapsed into ONE virtual segment P0 → P2 (its control point removed), the
// solver runs on that reduced chain, and the control points are re-derived
// afterwards: an arc whose endpoints both translated keeps its exact shape,
// an arc whose chord changed keeps its sagitta and the control's position
// along the arc (relocateArcControl). Without arcs this is the identity.
//
// Same contract as computeSegmentLengthEdit, indexes in the ORIGINAL points:
// `segmentIndex` is any stored segment — for an arc, either half maps to the
// arc span, so passing the index of P0 edits the chord.

// Reduced chain of a typed contour. Returns null when it has no exact arc.
export function collapseArcControlPoints({ points, closed = false }) {
  const n = points?.length ?? 0;
  if (n < 3) return null;
  const at = (k) => points[((k % n) + n) % n];
  const lastStart = closed ? n - 1 : n - 3;
  const controls = [];
  const isControl = new Array(n).fill(false);
  for (let i = 0; i <= lastStart; i++) {
    const c = (i + 1) % n;
    if (isControl[c]) continue;
    if (!isExactArcTriplet(at(i), at(i + 1), at(i + 2))) continue;
    isControl[c] = true;
    controls.push({ origIndex: c, startOrig: i, endOrig: (i + 2) % n });
  }
  if (!controls.length) return null;

  const reducedPoints = [];
  const origIndexOfReduced = [];
  const reducedIndexOfOrig = new Array(n).fill(-1);
  points.forEach((p, i) => {
    if (isControl[i]) return;
    reducedIndexOfOrig[i] = reducedPoints.length;
    reducedPoints.push(p);
    origIndexOfReduced.push(i);
  });

  // Stored segment k (points[k] → points[k+1]) → reduced segment index (the
  // reduced index of its start point; both halves of an arc → the span).
  const reducedSegmentOf = (k) => {
    const start = ((k % n) + n) % n;
    if (isControl[start]) {
      const ctl = controls.find((c) => c.origIndex === start);
      return reducedIndexOfOrig[ctl.startOrig];
    }
    return reducedIndexOfOrig[start];
  };

  return {
    controls,
    isControl,
    reducedPoints,
    origIndexOfReduced,
    reducedIndexOfOrig,
    reducedSegmentOf,
  };
}

export default function computeContourLengthEdit({
  points,
  closed = false,
  segmentIndex,
  targetPx,
  lockedSegmentIndexes = new Set(),
  lockedPointIndexes = new Set(),
  anglesLocked = false,
}) {
  const reduced = collapseArcControlPoints({ points, closed });
  if (!reduced) {
    return computeSegmentLengthEdit({
      points,
      closed,
      segmentIndex,
      targetPx,
      lockedSegmentIndexes,
      lockedPointIndexes,
      anglesLocked,
    });
  }

  const {
    controls,
    isControl,
    reducedPoints,
    origIndexOfReduced,
    reducedIndexOfOrig,
    reducedSegmentOf,
  } = reduced;

  const reducedLockedSegments = new Set();
  for (const k of lockedSegmentIndexes) {
    const r = reducedSegmentOf(k);
    if (r >= 0) reducedLockedSegments.add(r);
  }
  // Control points carry no lock (none is offered in the UI).
  const reducedLockedPoints = new Set();
  for (const i of lockedPointIndexes) {
    if (i < 0 || i >= points.length || isControl[i]) continue;
    reducedLockedPoints.add(reducedIndexOfOrig[i]);
  }

  const result = computeSegmentLengthEdit({
    points: reducedPoints,
    closed,
    segmentIndex: reducedSegmentOf(segmentIndex),
    targetPx,
    lockedSegmentIndexes: reducedLockedSegments,
    lockedPointIndexes: reducedLockedPoints,
    anglesLocked,
  });
  if (!result.ok) return result;

  const moves = result.moves.map(({ index, x, y }) => ({
    index: origIndexOfReduced[index],
    x,
    y,
  }));
  const movedByOrig = new Map(moves.map((m) => [m.index, m]));
  const posOf = (i) => movedByOrig.get(i) ?? points[i];

  for (const ctl of controls) {
    if (!movedByOrig.has(ctl.startOrig) && !movedByOrig.has(ctl.endOrig))
      continue;
    const next = relocateArcControl({
      p0: points[ctl.startOrig],
      p1: points[ctl.origIndex],
      p2: points[ctl.endOrig],
      newP0: posOf(ctl.startOrig),
      newP2: posOf(ctl.endOrig),
    });
    moves.push({ index: ctl.origIndex, x: next.x, y: next.y });
  }

  return { ok: true, moves };
}
