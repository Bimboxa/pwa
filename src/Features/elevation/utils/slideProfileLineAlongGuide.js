import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

// 2D drag of an extrusion profile: the profile SLIDES ALONG the guide
// polyline (its crossing point follows the contour, arcs included) while
// staying NORMAL to the guide's local tangent.
//
// Model:
//   1. anchor C0 = the profile's crossing point with the guide (fallback:
//      the guide point closest to the profile chain), with the crossed
//      segment's right normal n0;
//   2. each profile vertex keeps its SIGNED offset u_i = (P_i − C0)·n0
//      (its transverse abscissa relative to the crossing);
//   3. the drag target C0 + deltaPos is projected back onto the guide → new
//      anchor F with local right normal n;
//   4. new positions: P_i' = F + n·u_i — the profile re-orients on the
//      local normal as it rides along the contour.
//
// Inputs are pixel-space: guidePoints [{x, y, type?}] (RAW vertices — arcs
// are expanded here), profilePoints [{x, y}], deltaPos {x, y}.
// Returns the new profile plan positions [{x, y}] (same order/count as
// profilePoints), or null when degenerate.
const GUIDE_ARC_SAMPLES = 16;

export default function slideProfileLineAlongGuide({
  guidePoints,
  closeLine = false,
  profilePoints,
  deltaPos,
}) {
  const rawGuide = (guidePoints || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  const profile = (profilePoints || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (rawGuide.length < 2 || profile.length < 2 || !deltaPos) return null;

  let guide = expandArcsInPath(rawGuide, GUIDE_ARC_SAMPLES, !!closeLine);
  // Close the ring so the wrap segment is projectable / crossable too.
  if (closeLine && guide.length > 1) guide = [...guide, guide[0]];
  if (guide.length < 2) return null;

  const rightNormalOf = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
  };

  // --- 1. anchor C0 + local normal n0 --------------------------------------
  const intersect = (a, b, c, d) => {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-12) return null;
    const acX = c.x - a.x;
    const acY = c.y - a.y;
    const t = (acX * sY - acY * sX) / denom;
    const u = (acX * rY - acY * rX) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: a.x + rX * t, y: a.y + rY * t };
  };

  let C0 = null;
  let n0 = null;
  for (let i = 0; i < guide.length - 1 && !C0; i += 1) {
    for (let j = 0; j < profile.length - 1; j += 1) {
      const hit = intersect(guide[i], guide[i + 1], profile[j], profile[j + 1]);
      if (hit) {
        C0 = hit;
        n0 = rightNormalOf(guide[i], guide[i + 1]);
        break;
      }
    }
  }
  if (!C0) {
    // No crossing: anchor on the guide point closest to the profile chain.
    let best = null;
    for (const p of profile) {
      const proj = projectPointOnPolyline(p, guide);
      if (proj && (!best || proj.distance < best.distance)) best = proj;
    }
    if (!best) return null;
    C0 = best.projected;
    n0 = rightNormalOf(guide[best.segIndex], guide[best.segIndex + 1]);
  }

  // --- 2. transverse offsets relative to the anchor ------------------------
  const offsets = profile.map((p) => (p.x - C0.x) * n0.x + (p.y - C0.y) * n0.y);

  // --- 3. slide the anchor along the guide ---------------------------------
  const target = { x: C0.x + deltaPos.x, y: C0.y + deltaPos.y };
  const proj = projectPointOnPolyline(target, guide);
  if (!proj) return null;
  const F = proj.projected;
  const n = rightNormalOf(guide[proj.segIndex], guide[proj.segIndex + 1]);

  // --- 4. rebuild the profile on the local normal --------------------------
  return offsets.map((u) => ({ x: F.x + n.x * u, y: F.y + n.y * u }));
}
