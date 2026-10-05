import getIsoSurfaceOffsetsSampler from "./getIsoSurfaceOffsetsSampler";

// "Bord d'ouverture" segments of a POLYGON folded on isoHeightLines: a run of
// consecutive flagged contour segments outlines an opening biting the contour
// (notch). The surface is the one of the polygon WITHOUT the notch — each run
// replaced by a straight segment between its first and last point — and the
// notch is opened in it: the vertices inside a run take the offsets of that
// surface at their position, instead of their own stored offsets.
//
// Evaluated at resolve time (useAnnotationsV2), like the iso pinning: moving
// an iso line or a vertex keeps the notch on the sheet with nothing to
// re-bake.
//
// All inputs are in pixel space (resolved):
//   - points: contour ring
//   - notchSegmentsIdx: effective flagged segment indices (segment i =
//     points[i] → points[i + 1], closing segment n - 1)
//   - isoHeightLines / profileLines: resolved lines of the annotation
// Returns the ring (same reference when nothing applies).
export default function applyNotchSegmentsToRing({
  points,
  notchSegmentsIdx,
  isoHeightLines,
  profileLines,
}) {
  const n = points?.length ?? 0;
  if (n < 4 || !notchSegmentsIdx?.length) return points;

  const flagged = new Set(
    notchSegmentsIdx.filter((i) => Number.isInteger(i) && i >= 0 && i < n)
  );
  if (flagged.size === 0 || flagged.size === n) return points;

  // A vertex is inside a run when both its incoming and outgoing segments
  // are flagged.
  const inside = points.map(
    (_, i) => flagged.has(i) && flagged.has((i - 1 + n) % n)
  );
  if (!inside.some(Boolean)) return points;

  const bridged = points.filter((_, i) => !inside[i]);
  if (bridged.length < 3) return points;

  const sample = getIsoSurfaceOffsetsSampler(
    { points: bridged, isoHeightLines, profileLines },
    { extrapolate: true }
  );
  if (!sample) return points;

  return points.map((p, i) => {
    if (!inside[i] || typeof p?.x !== "number" || typeof p?.y !== "number") {
      return p;
    }
    const offsets = sample(p);
    return offsets ? { ...p, ...offsets } : p;
  });
}
