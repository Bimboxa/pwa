import {
  expandArcsInPath,
  expandRingWithOffsets,
} from "Features/geometry/utils/arcSampling";
import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";
import buildWallProfileFromChain from "Features/annotations/utils/buildWallProfileFromChain";

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
// Two profiles (see the toolbar SVG illustrations). maxHeight is optional for
// both (see buildWallProfileFromChain):
//   - "MAX":      wallTop = maxHeight (flat ceiling). The wall height decreases
//                 up-slope and ends where the ground reaches maxHeight. Without
//                 a maxHeight, the ceiling is the highest ramp vertex.
//   - "CONSTANT": wallTop = min(ground + constantHeight, maxHeight). The wall
//                 keeps a constant height above the slope, then is capped at the
//                 absolute ceiling (break point where ground = maxHeight - H).
//                 Without a maxHeight, the height is kept all along the slope.
//
// Heights are absolute, measured from the baseMap level (offset = 0), which is
// also where the lowest ramp vertex sits (offsets are normalised so min = 0).
//
// Inputs:
//   - annotation: resolved annotation ({ points: [{x,y,offsetTop}], guideLines })
//   - side:       "LEFT" | "RIGHT" (relative to walking up the slope)
//   - profileType:"MAX" | "CONSTANT"
//   - constantHeight: meters (used by CONSTANT only)
//   - maxHeight:  meters (optional absolute ceiling)
//
// Returns an ordered array [{ x, y, ground, wallTop }] (pixels + meters), or
// null when no wall can be built (no guideLine, ceiling below the ground, ...).

const EPS = 1e-6;
const ARC_SAMPLES = 16;
// expandRingWithOffsets emits 2 segments per sample-half, so 4 samples ≈ 8
// straight segments per S-C-S arc in the polygon contour.
const CONTOUR_ARC_SAMPLES = 4;

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

export default function buildSlopeWallPolyline({
  annotation,
  side,
  profileType,
  constantHeight,
  maxHeight,
}) {
  const rawPts = Array.isArray(annotation?.points) ? annotation.points : [];
  if (rawPts.length < 3) return null;
  // maxHeight is optional: buildWallProfileFromChain keeps a constant height all
  // along the slope (CONSTANT) or caps at the highest ramp vertex (MAX).

  // Expand contour arcs (S-C-S triplets) so the wall follows the curve instead
  // of collapsing onto its 2 chord segments. The closed ring keeps offsetTop
  // (the ramp ground height) interpolated along each sampled arc point.
  const pts = expandRingWithOffsets(rawPts, CONTOUR_ARC_SAMPLES, true);

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

  return buildWallProfileFromChain(chain, {
    profileType,
    height: constantHeight,
    maxHeight,
  });
}
