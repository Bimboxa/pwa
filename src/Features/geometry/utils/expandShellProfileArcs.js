import { expandArcsInPath } from "./arcSampling";

const ARC_SAMPLES = 12;

// Expands the VERTICAL arcs of a shell profile polyline into sampled
// vertices. A "circle" vertex is an arc control point of the SECTION curve
// (curvilinear abscissa s, height h): the curve through prev → control → next
// is a circular arc in (s, h) space. The sampled points are mapped back to
// plan positions along the original polyline path (the plan path itself is
// unchanged by vertical arcs).
//
// Units must be CONSISTENT between plan x/y and height (meters/basemap-local
// for the 3D and qties callers) — an arc's shape depends on the aspect ratio.
//
// Input:  [{x, y, height, type?}, ...]
// Output: [{x, y, height}, ...] (straight-only, ready for the TENT partition
// and the DOME drape).
export default function expandShellProfileArcs(polyline) {
  const pts = (polyline || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  if (!pts.some((p) => p.type === "circle")) {
    return pts.map((p) => ({ x: p.x, y: p.y, height: Number(p.height) || 0 }));
  }

  // Curvilinear abscissa of each vertex along the plan path.
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(
      cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    );
  }
  const total = cum[cum.length - 1];
  const planAt = (s) => {
    const sc = Math.max(0, Math.min(total, s));
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (sc <= cum[i + 1] || i === pts.length - 2) {
        const span = Math.max(cum[i + 1] - cum[i], 1e-9);
        const t = Math.max(0, Math.min(1, (sc - cum[i]) / span));
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
        };
      }
    }
    return { x: pts[0].x, y: pts[0].y };
  };

  // Sample the S-C-S arcs in (s, height) space, then map s back to plan.
  const sectionPts = pts.map((p, i) => ({
    x: cum[i],
    y: Number(p.height) || 0,
    ...(p.type === "circle" ? { type: "circle" } : {}),
  }));
  const sampled = expandArcsInPath(sectionPts, ARC_SAMPLES, false);

  return sampled
    .filter((q) => Number.isFinite(q?.x) && Number.isFinite(q?.y))
    .map((q) => ({ ...planAt(q.x), height: q.y }));
}
