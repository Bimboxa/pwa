import applyGuideLineSlopeOffsets from "Features/annotations/utils/applyGuideLineSlopeOffsets";

// Derives the ramp height (`offsetTop`) of every ring vertex from its
// projection onto the guideLine, so the sloped top surface is a deterministic
// function of position (iso-height contours run normal to the guideLine).
//
// This is evaluated at resolve time (useAnnotationsV2) rather than baked into
// the stored points: any vertex added/moved on the contour afterwards
// automatically gets the right height, and the 3D mesh / quantities stay
// consistent with the guideLine instead of drifting when the contour changes.
//
// All inputs are in pixel space (resolved). Returns { points, cuts, innerPoints }
// with `offsetTop` overwritten per the slope law; everything else is preserved.
export default function applyGuideLineRampToRings({
  points,
  cuts,
  innerPoints,
  guideLine,
  meterByPx,
  slopePct,
}) {
  const result = { points, cuts, innerPoints };
  if (!Array.isArray(guideLine) || guideLine.length < 2) return result;
  if (!Number.isFinite(slopePct) || slopePct === 0) return result;

  const vertices = [
    ...(points || []),
    ...((cuts || []).flatMap((c) => c?.points || [])),
    ...(innerPoints || []),
  ].filter((p) => p && p.id != null && typeof p.x === "number");

  const offsetMap = applyGuideLineSlopeOffsets({
    guidePts: guideLine,
    vertices,
    meterByPx,
    slopePct,
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
