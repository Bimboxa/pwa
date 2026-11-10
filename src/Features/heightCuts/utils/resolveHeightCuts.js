import resolveGuideLine from "../../annotations/utils/resolveGuideLine.js";

import { isClosedTrace } from "./computeHeightFaces.js";

// Stored height cuts (guide-line ref shape [{pointId, type}], normalized
// coordinates in db.points) → pixel space.
//
// Returns { traces, faceEntries }:
// - traces: the heightCuts rows with resolved `points` and `rawIndex` (index
//   in the stored array — degenerate traces are dropped) ;
// - faceEntries: the heightCutFaces rows with their resolved `points` (ONE
//   point: the seed, stored like a line so every point-moving service
//   carries it) and `seed` {x, y}.
export default function resolveHeightCuts({
  heightCuts,
  heightCutFaces,
  pointsIndex,
  imageSize,
}) {
  const traces = [];
  (heightCuts || []).forEach((heightCut, rawIndex) => {
    const points = resolveRefs(heightCut?.points, pointsIndex, imageSize);
    if (points.length < (isClosedTrace(heightCut) ? 3 : 2)) return;
    traces.push({ ...heightCut, points, rawIndex });
  });

  const faceEntries = [];
  for (const entry of heightCutFaces || []) {
    const points = resolveRefs(entry?.points, pointsIndex, imageSize);
    if (!points.length) continue;
    faceEntries.push({
      ...entry,
      points,
      seed: { x: points[0].x, y: points[0].y },
    });
  }
  return { traces, faceEntries };
}

function resolveRefs(refs, pointsIndex, imageSize) {
  if (!Array.isArray(refs) || !pointsIndex || !imageSize) return [];
  return resolveGuideLine({ guideLine: refs, pointsIndex, imageSize }).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
}
