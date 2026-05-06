// Pure geometry helpers shared between the 2D "Contour" feature
// (useWallBoundaries) and the 3D wall extrusion path. Converts a polyline
// centerline + half-width into a closed rectangle ring.

export function segNormal(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: -1 };
  return { x: -dy / len, y: dx / len };
}

export function lineLineIntersection(p1, v1, p2, v2) {
  const cross = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(cross) < 1e-8) return null;
  const t = ((p2.x - p1.x) * v2.y - (p2.y - p1.y) * v2.x) / cross;
  return { x: p1.x + t * v1.x, y: p1.y + t * v1.y };
}

/**
 * Compute the offset of a polyline at distance d (positive = left of the
 * direction of travel). Joins between segments are computed by intersecting
 * the offset lines (miter join), preserving sharp corners cleanly.
 *
 * When `closeLine` is true, the centerline is treated as a closed ring: the
 * last segment wraps from points[n-1] → points[0], every output vertex is
 * computed as the intersection of two adjacent offset lines (no end caps),
 * and exactly n points are returned (no duplicate closing vertex).
 */
export function computeOffsetPolyline(path, d, closeLine = false) {
  const n = path.length;
  if (n < 2) return [];

  const segCount = closeLine ? n : n - 1;
  const lines = [];
  for (let i = 0; i < segCount; i++) {
    const a = path[i];
    const b = path[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    lines.push({
      p: { x: a.x + nx * d, y: a.y + ny * d },
      v: { x: ux, y: uy },
      len,
    });
  }
  if (lines.length === 0) return [];

  if (closeLine) {
    const m = lines.length;
    const result = [];
    for (let i = 0; i < m; i++) {
      const prev = lines[(i - 1 + m) % m];
      const curr = lines[i];
      const inter = lineLineIntersection(prev.p, prev.v, curr.p, curr.v);
      result.push(inter ? { ...inter } : { ...curr.p });
    }
    return result;
  }

  const result = [{ ...lines[0].p }];
  for (let i = 1; i < lines.length; i++) {
    const inter = lineLineIntersection(
      lines[i - 1].p,
      lines[i - 1].v,
      lines[i].p,
      lines[i].v
    );
    result.push(inter ? { ...inter } : { ...lines[i].p });
  }
  const last = lines[lines.length - 1];
  result.push({
    x: last.p.x + last.v.x * last.len,
    y: last.p.y + last.v.y * last.len,
  });

  return result;
}

/**
 * Convert a centerline polyline (array of {x, y}) into a closed rectangle ring
 * around it, given the wall half-width. Returns a GeoJSON-style array of
 * [x, y] pairs (last == first).
 */
export default function wallToRectRing(points, halfWidth) {
  const left = computeOffsetPolyline(points, halfWidth);
  const right = computeOffsetPolyline(points, -halfWidth);
  if (left.length < 2 || right.length < 2) return null;

  const ring = [];
  for (const p of left) ring.push([p.x, p.y]);
  for (let i = right.length - 1; i >= 0; i--) {
    ring.push([right[i].x, right[i].y]);
  }
  ring.push([left[0].x, left[0].y]); // close
  return ring;
}

function signedArea(ring) {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Convert a CLOSED centerline polyline + half-width into a hollow ring
 * (outer contour + inner contour, suitable for extrudeClosedShape with the
 * inner ring as a hole). Both rings are arrays of {x, y} with no duplicate
 * closing vertex.
 *
 * The outer ring is whichever of the two side offsets has the larger
 * absolute signed area, so it works regardless of the source winding.
 */
export function wallToHollowRings(points, halfWidth) {
  if (!points || points.length < 3) return null;
  const a = computeOffsetPolyline(points, halfWidth, true);
  const b = computeOffsetPolyline(points, -halfWidth, true);
  if (a.length < 3 || b.length < 3) return null;

  const areaA = Math.abs(signedArea(a));
  const areaB = Math.abs(signedArea(b));
  const outer = areaA >= areaB ? a : b;
  const inner = areaA >= areaB ? b : a;
  return { outer, inner };
}
