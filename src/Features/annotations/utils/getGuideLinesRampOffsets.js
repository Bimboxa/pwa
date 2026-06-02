import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

const ARC_SAMPLES = 16;

// Derives the ramp height (`offsetTop`, meters) of every polygon vertex from a
// SEQUENCE of guideLines, each with its own slope. The guideLines follow one
// another (drawing order = ramp order); the first defines the low point.
//
// Height accumulates along the concatenated spine: within guideLine i the
// height rises by slope_i; the cumulative base of line i is the height reached
// at the end of all previous lines (continuity at junctions).
//
// Each vertex is assigned to its NEAREST guideLine (projected independently per
// line, so end-to-end gaps don't create spurious connector segments). Clamping
// at a line's end yields exactly the next line's base height → continuous ramp.
//
// Inputs (pixel space):
//   - guideLines: [{ points: [{x,y,type?}], slopePct }]  (resolved)
//   - polygonPts: every ring vertex [{id,x,y}]
//   - meterByPx:  pixel→meter scale
//
// Returns Map<vertexId, offsetTop> (empty when no usable guideLine).
export default function getGuideLinesRampOffsets({
  guideLines,
  polygonPts,
  meterByPx,
}) {
  const out = new Map();
  if (!Array.isArray(guideLines) || guideLines.length === 0) return out;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return out;

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
  if (lines.length === 0) return out;

  // Assign each vertex to its nearest line, compute accumulated height.
  let globalMin = Infinity;
  const heightById = new Map();
  for (const v of polygonPts || []) {
    if (!v?.id || typeof v.x !== "number" || typeof v.y !== "number") continue;
    let best = null; // { dist, line }
    for (const line of lines) {
      const proj = projectPointOnPolyline(v, line.polyline);
      if (!proj) continue;
      if (!best || proj.distance < best.dist) {
        best = { dist: proj.distance, s: proj.s, line };
      }
    }
    if (!best) continue;
    const h = best.line.hBase + best.s * meterByPx * best.line.slope;
    heightById.set(v.id, h);
    if (h < globalMin) globalMin = h;
  }
  if (heightById.size === 0 || !Number.isFinite(globalMin)) return out;

  for (const [id, h] of heightById.entries()) {
    out.set(id, h - globalMin);
  }
  return out;
}
