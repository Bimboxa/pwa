import getInlineExtrusionSetup from "Features/annotations/utils/getInlineExtrusionSetup";

// Mirrors an inline profile (POLYLINE `profileLines[i]`, plan chain) to the
// OTHER side of its guide: every profile vertex is reflected across the
// straight line of the guide segment the profile registers on (the segment
// it crosses in plan, else the nearest one — getInlineExtrusionSetup's
// `crossedSegIndex`, whose two endpoints come back as `extremities`).
//
// Why a reflection across that segment: the 3D registration reads
// `u = (s_vertex − s_E) × dirSign` with s = signed abscissa on the profile's
// own axis and dirSign = sign(axis · right normal of the segment). A
// reflection across the segment line keeps every abscissa and the anchor
// extremity E (it lies on the line) and flips the axis' normal component,
// so dirSign flips and u → −u: the cross-section swaps sides, heights
// untouched. Pure (no Dexie), usable in node tests.
//
// Inputs in ONE consistent plan frame (pixels or meters):
//   - guidePoints: [{x, y}] arc-expanded guide chain
//   - closeLine: whether the guide chain closes
//   - profilePoints: [{x, y, ...}] the profile vertices (extra fields kept)
// Returns the mirrored profile points (same order, extra fields spread), or
// null when the registration is degenerate (< 2 points, zero-length
// segment).
export default function mirrorProfilePointsAcrossGuide({
  guidePoints,
  closeLine = false,
  profilePoints,
}) {
  const setup = getInlineExtrusionSetup({
    guidePoints,
    profilePoints,
    closeLine,
  });
  if (!setup) return null;
  const [A, B] = setup.extremities;
  return reflectPointsAcrossLine(profilePoints, A, B);
}

// Reflects `points` across the line through A and B (extra fields kept).
// null when A === B.
export function reflectPointsAcrossLine(points, A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 1e-18)) return null;
  return points.map((p) => {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return p;
    const t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / len2;
    const fx = A.x + dx * t;
    const fy = A.y + dy * t;
    return { ...p, x: 2 * fx - p.x, y: 2 * fy - p.y };
  });
}
