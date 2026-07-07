import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

const ARC_SAMPLES = 16;

// Builds a geometric sampler of the guideLine ramp: given any pixel point, it
// returns the ramp ground height (`offsetTop`, meters) at that position — the
// SAME value getGuideLinesRampOffsets assigns to a ring vertex, so it stays
// consistent with the rendered sloped floor.
//
// It shares the exact spine construction AND the `globalMin` rebasing of
// getGuideLinesRampOffsets: the height is measured so the lowest ramp vertex of
// the polygon sits at 0. `globalMin` is computed over `polygonPts` (the same set
// the resolve-time ramp rebases against: points + cuts + innerPoints).
//
// Why a sampler (not the per-vertex map): inside procedures the wall chains pass
// through tessellation / arc-collapse / water-split transforms that mint fresh
// {x,y} vertices with no `offsetTop`, so ground must be re-derived from position.
//
// Inputs (pixel space):
//   - guideLines: [{ points: [{x,y,type?}], slopePct }]  (resolved)
//   - polygonPts: ring vertices used for the globalMin rebasing [{id,x,y}]
//   - meterByPx:  pixel→meter scale
//
// Returns { ok, globalMin, groundAt(point) => meters }.
//   - ok === false when no usable guideLine (then groundAt returns 0).
export default function getGuideLineRampSampler({
  guideLines,
  polygonPts,
  meterByPx,
}) {
  const disabled = { ok: false, globalMin: 0, groundAt: () => 0 };

  if (!Array.isArray(guideLines) || guideLines.length === 0) return disabled;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return disabled;

  // Build per-line polylines + lengths + cumulative height base.
  const lines = [];
  let hBase = 0; // meters, height at the start of the current line
  for (const g of guideLines) {
    const pts = Array.isArray(g?.points) ? g.points : [];
    if (pts.length < 2) continue;
    const polyline = expandArcsInPath(pts, ARC_SAMPLES, false)
      .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
      .map((p) => ({ x: p.x, y: p.y }));
    if (polyline.length < 2) continue;

    let L2D = 0;
    for (let i = 0; i < polyline.length - 1; i++) {
      L2D += Math.hypot(
        polyline[i + 1].x - polyline[i].x,
        polyline[i + 1].y - polyline[i].y
      );
    }
    if (!Number.isFinite(L2D) || L2D < 1e-6) continue;

    const slope = (Number(g?.slopePct) || 0) / 100;
    lines.push({ polyline, L2D, slope, hBase });
    hBase += L2D * meterByPx * slope; // height reached at this line's end
  }
  if (lines.length === 0) return disabled;

  // Raw (un-rebased) height at an arbitrary point: assign to nearest line,
  // accumulate the base height + the along-line rise.
  const rawHeightAt = (point) => {
    if (!point || typeof point.x !== "number" || typeof point.y !== "number") {
      return null;
    }
    let best = null; // { dist, s, line }
    for (const line of lines) {
      const proj = projectPointOnPolyline(point, line.polyline);
      if (!proj) continue;
      if (!best || proj.distance < best.dist) {
        best = { dist: proj.distance, s: proj.s, line };
      }
    }
    if (!best) return null;
    return best.line.hBase + best.s * meterByPx * best.line.slope;
  };

  // Rebase against the same vertex set as the resolve-time ramp.
  let globalMin = Infinity;
  for (const v of polygonPts || []) {
    const h = rawHeightAt(v);
    if (h != null && h < globalMin) globalMin = h;
  }
  if (!Number.isFinite(globalMin)) return disabled;

  return {
    ok: true,
    globalMin,
    groundAt: (point) => {
      const h = rawHeightAt(point);
      return h == null ? 0 : h - globalMin;
    },
  };
}
