import roundForDisplay from "./roundForDisplay";

// Plan-position bucket (normalized [0..1] space) for grouping the cycle's
// corners into band posts — same tolerance as the point-reuse epsilon of
// commitDrawnFaceService.
const PLAN_KEY_EPS = 5e-4;

// Encode a vertical (PERPENDICULAR) face cycle as an OPEN polyline band.
// Walking the cycle visits each plan position up to twice (top run + bottom
// run) — emitting one polyline point per cycle corner would make
// extrudePolylineWall double-cover the band and render the full bounding
// rectangle (a wall triangle came out as a rectangle). Instead: one point
// per unique plan position, ordered along the (collinear) footprint line,
// carrying the local z interval as offsetBottom (bottom raised above
// offsetZ) / offsetTop (top lowered below offsetZ + height). Corners where
// the interval is empty collapse to points, so triangles, gables and
// ribbons all encode exactly.
//
// Input: classification.projected — [{x, y, offset}] in normalized baseMap
// space, offset in meters. Returns { points, offsetZ, height } or null for
// degenerate footprints.
export default function buildVerticalBandPoints(projected) {
  if (!projected?.length) return null;

  const offsets = projected.map((p) => p.offset);
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);

  const byPlanKey = new Map(); // key -> {x, y, zMin, zMax}
  for (const p of projected) {
    const key = `${Math.round(p.x / PLAN_KEY_EPS)}_${Math.round(
      p.y / PLAN_KEY_EPS
    )}`;
    const entry = byPlanKey.get(key);
    if (!entry) {
      byPlanKey.set(key, { x: p.x, y: p.y, zMin: p.offset, zMax: p.offset });
    } else {
      if (p.offset < entry.zMin) entry.zMin = p.offset;
      if (p.offset > entry.zMax) entry.zMax = p.offset;
    }
  }
  const posts = [...byPlanKey.values()];
  if (posts.length < 2) return null;

  // Order the posts along the footprint line (collinear by the PERPENDICULAR
  // classification invariant), using the farthest pair as direction.
  let p0 = posts[0];
  let p1 = posts[1];
  let bestD = -1;
  for (const a of posts) {
    for (const b of posts) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = dx * dx + dy * dy;
      if (d > bestD) {
        bestD = d;
        p0 = a;
        p1 = b;
      }
    }
  }
  const dirX = p1.x - p0.x;
  const dirY = p1.y - p0.y;
  const along = (p) => (p.x - p0.x) * dirX + (p.y - p0.y) * dirY;
  posts.sort((a, b) => along(a) - along(b));

  return {
    points: posts.map((p) => ({
      x: p.x,
      y: p.y,
      offsetBottom: roundForDisplay(p.zMin - minOffset),
      offsetTop: roundForDisplay(p.zMax - maxOffset),
    })),
    offsetZ: roundForDisplay(minOffset),
    height: roundForDisplay(maxOffset - minOffset),
  };
}
