import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";

// Builds the polyline of a slope side wall (paroi) from a resolved POLYGON
// annotation that carries a guideLine ramp.
//
// The neutral line is the FUSION of all the guideLines (their points
// concatenated in order). It divides the polygon into a left side and a right
// side. A wall takes the polygon vertices on its side of the neutral line, kept
// in the polygon's own vertex order (a contiguous run of the contour) — so the
// wall follows the polygon and can never self-cross. Each returned point
// carries:
//   - ground:  the ramp ground height in meters (= the polygon vertex offsetTop,
//              already derived from the guideLine by useAnnotationsV2)
//   - wallTop: the wall top height in meters, per the chosen profile
//
// The caller writes these as offsetBottom (ground) / offsetTop (wallTop) on the
// generated POLYLINE; extrudePolylineWall.js then extrudes the vertical band.
//
// Two profiles (see the toolbar SVG illustrations):
//   - "MAX":      wallTop = maxHeight (flat ceiling). The wall height decreases
//                 up-slope and ends where the ground reaches maxHeight.
//   - "CONSTANT": wallTop = min(ground + constantHeight, maxHeight). The wall
//                 keeps a constant height above the slope, then is capped at the
//                 absolute ceiling (break point where ground = maxHeight - H).
//
// Heights are absolute, measured from the baseMap level (offset = 0), which is
// also where the lowest ramp vertex sits (offsets are normalised so min = 0).
//
// Inputs:
//   - annotation: resolved annotation ({ points: [{x,y,offsetTop}], guideLines })
//   - side:       "LEFT" | "RIGHT" (relative to walking up the slope)
//   - profileType:"MAX" | "CONSTANT"
//   - constantHeight: meters (used by CONSTANT only)
//   - maxHeight:  meters (absolute ceiling)
//
// Returns an ordered array [{ x, y, ground, wallTop }] (pixels + meters), or
// null when no wall can be built (no guideLine, ceiling below the ground, ...).

const EPS = 1e-6;
const ARC_SAMPLES = 16;

function cross2(ux, uy, vx, vy) {
  return ux * vy - uy * vx;
}

// Fuses all guideLines into a single neutral polyline (pixel space), arcs
// expanded, junction duplicates removed.
function mergeGuideLines(annotation) {
  const gls = (annotation?.guideLines || []).filter(
    (g) => Array.isArray(g?.points) && g.points.length >= 2
  );
  if (!gls.length) return null;

  const merged = [];
  for (const g of gls) {
    const expanded = expandArcsInPath(g.points, ARC_SAMPLES, false).filter(
      (p) => typeof p?.x === "number" && typeof p?.y === "number"
    );
    for (const p of expanded) {
      const last = merged[merged.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < EPS) continue;
      merged.push({ x: p.x, y: p.y });
    }
  }
  return merged.length >= 2 ? merged : null;
}

// Signed side of a point w.r.t. the neutral polyline, using the nearest segment:
// < 0 = left of the line direction (screen y-down), > 0 = right.
function sideOfPolyline(point, polyline) {
  let best = null;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const proj = projectPointOnSegment(point, a, b);
    if (!best || proj.distance < best.distance)
      best = { distance: proj.distance, a, b };
  }
  if (!best) return 0;
  return cross2(
    best.b.x - best.a.x,
    best.b.y - best.a.y,
    point.x - best.a.x,
    point.y - best.a.y
  );
}

// Longest contiguous (cyclic) run of indices whose side === want, preserving
// ring order. Returns an array of indices.
function longestCyclicRun(sides, want) {
  const n = sides.length;
  const anchor = sides.findIndex((s) => s !== want);
  if (anchor === -1) return [...Array(n).keys()]; // all on this side

  let best = [];
  let cur = [];
  for (let k = 1; k <= n; k++) {
    const idx = (anchor + k) % n;
    if (sides[idx] === want) {
      cur.push(idx);
    } else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  if (cur.length > best.length) best = cur;
  return best;
}

// Inserts interpolated points wherever an edge crosses one of the ground
// `levels`, so the wall top profile has a clean vertex at each transition.
function insertGroundCrossings(chain, levels) {
  const out = [chain[0]];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const dg = b.ground - a.ground;
    const inserts = [];
    if (Math.abs(dg) > EPS) {
      for (const lvl of levels) {
        const t = (lvl - a.ground) / dg;
        if (t > EPS && t < 1 - EPS) {
          inserts.push({
            t,
            x: a.x + t * (b.x - a.x),
            y: a.y + t * (b.y - a.y),
            ground: lvl,
          });
        }
      }
      inserts.sort((p, q) => p.t - q.t);
    }
    for (const ins of inserts) {
      out.push({ x: ins.x, y: ins.y, ground: ins.ground });
    }
    out.push(b);
  }
  return out;
}

export default function buildSlopeWallPolyline({
  annotation,
  side,
  profileType,
  constantHeight,
  maxHeight,
}) {
  const pts = Array.isArray(annotation?.points) ? annotation.points : [];
  if (pts.length < 3) return null;
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) return null;

  const neutral = mergeGuideLines(annotation);
  if (!neutral) return null;

  // Side of each polygon vertex w.r.t. the fused neutral line.
  const want = side === "LEFT" ? -1 : 1;
  const sides = pts.map((p) => {
    const s = sideOfPolyline(p, neutral);
    return Math.abs(s) < EPS ? 0 : s < 0 ? -1 : 1;
  });

  // Take the contiguous run of vertices on the requested side, in polygon order.
  const indices = longestCyclicRun(sides, want);
  if (indices.length < 2) return null;

  const chain = indices.map((i) => ({
    x: pts[i].x,
    y: pts[i].y,
    ground: Number.isFinite(pts[i].offsetTop) ? pts[i].offsetTop : 0,
  }));

  // Ground levels where the wall top profile changes / ends.
  const H = profileType === "CONSTANT" ? constantHeight : 0;
  const levels = [];
  if (profileType === "CONSTANT") {
    const gBreak = maxHeight - H;
    if (gBreak > EPS) levels.push(gBreak);
  }
  levels.push(maxHeight); // ceiling

  const dense = insertGroundCrossings(chain, levels);

  // Compute wallTop per point (clamped at the ceiling). Beyond-ceiling points
  // keep their place in the polyline; extrudePolylineWall hides the negative
  // (ground > wallTop) spans, so the visible wall tapers off at the ceiling.
  let anyPositive = false;
  const out = dense.map((p) => {
    const g = p.ground;
    const wallTop =
      profileType === "CONSTANT" ? Math.min(g + H, maxHeight) : maxHeight;
    if (wallTop - g > EPS) anyPositive = true;
    return { x: p.x, y: p.y, ground: g, wallTop };
  });

  if (!anyPositive || out.length < 2) return null;
  return out;
}
