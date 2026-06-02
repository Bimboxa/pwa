import getGuideLinesRampOffsets from "Features/annotations/utils/getGuideLinesRampOffsets";

// Derives the ramp height (`offsetTop`) of every ring vertex from the sequence
// of guideLines, so the sloped top surface is a deterministic function of
// position (iso-height contours run normal to each guideLine, height
// accumulates along the ramp).
//
// Evaluated at resolve time (useAnnotationsV2) rather than baked into stored
// points: any vertex added/moved on the contour afterwards automatically gets
// the right height, and the 3D mesh / quantities stay consistent.
//
// All inputs are in pixel space (resolved). Returns { points, cuts, innerPoints }
// with `offsetTop` overwritten per the ramp; everything else is preserved.
export default function applyGuideLineRampToRings({
  points,
  cuts,
  innerPoints,
  guideLines,
  meterByPx,
}) {
  const result = { points, cuts, innerPoints };
  const usable =
    Array.isArray(guideLines) &&
    guideLines.some(
      (g) => Array.isArray(g?.points) && g.points.length >= 2 && g?.slopePct
    );
  if (!usable) return result;

  const polygonPts = [
    ...(points || []),
    ...((cuts || []).flatMap((c) => c?.points || [])),
    ...(innerPoints || []),
  ].filter((p) => p && p.id != null && typeof p.x === "number");

  const offsetMap = getGuideLinesRampOffsets({
    guideLines,
    polygonPts,
    meterByPx,
  });
  if (offsetMap.size === 0) return result;

  const applyRing = (ring) =>
    (ring || []).map((p) =>
      offsetMap.has(p?.id) ? { ...p, offsetTop: offsetMap.get(p.id) } : p
    );

  result.points = applyRing(points);
  if (Array.isArray(cuts)) {
    result.cuts = cuts.map((c) => ({ ...c, points: applyRing(c?.points) }));
  }
  if (Array.isArray(innerPoints)) {
    result.innerPoints = applyRing(innerPoints);
  }
  return result;
}
