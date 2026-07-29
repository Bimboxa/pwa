// Curvilinear abscissa along a 3D polyline chain (a maille base contour): the
// "développé" metric of the shell cut guide. The abscissa of a point is the
// summed chord length from the chain start — on the discretized base of a
// revolution this measures the polygon perimeter, not straight-line offsets.
//
// Pure (no three.js), world coordinates.

/**
 * @param {object} args
 * @param {[{x,y,z}]} args.points - ordered vertices (no closing duplicate)
 * @param {boolean} args.closed - closed ring (the closing segment is implied)
 * @returns {{points, closed, cum: number[], total: number} | null}
 *   `cum[i]` is the abscissa of `points[i]`; on a closed chain `cum` has one
 *   extra entry for the closing segment and `total` wraps back to `points[0]`.
 */
export function buildChainMeasure({ points, closed }) {
  if (!points || points.length < 2) return null;
  const n = points.length;
  const segCount = closed ? n : n - 1;
  const cum = [0];
  let total = 0;
  for (let i = 0; i < segCount; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    total += Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    cum.push(total);
  }
  if (!(total > 0)) return null;
  return { points, closed, cum, total };
}

/**
 * Nearest point of the chain to `p` (clamped projection on each segment).
 *
 * @returns {{s: number, point: {x,y,z}, distSq: number} | null}
 */
export function projectPointToChain(measure, p) {
  const { points, closed, cum } = measure;
  const n = points.length;
  const segCount = closed ? n : n - 1;
  let best = null;
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const ez = b.z - a.z;
    const lenSq = ex * ex + ey * ey + ez * ez;
    let t = 0;
    if (lenSq > 0) {
      t = ((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const point = { x: a.x + t * ex, y: a.y + t * ey, z: a.z + t * ez };
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const dz = p.z - point.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (!best || distSq < best.distSq) {
      best = { s: cum[i] + t * (cum[i + 1] - cum[i]), point, distSq };
    }
  }
  return best;
}

/**
 * Point and unit tangent at abscissa `s`. Closed chains wrap `s` modulo the
 * total length; open chains return null outside [0, total] — the caller must
 * HIDE an out-of-range guide, never clamp it (a clamped guide would label a
 * wrong distance).
 *
 * @returns {{point: {x,y,z}, tangent: {x,y,z}} | null}
 */
export function pointAtChainAbscissa(measure, s) {
  const { points, closed, cum, total } = measure;
  let sw = s;
  if (closed) {
    sw = ((s % total) + total) % total;
  } else if (s < 0 || s > total) {
    return null;
  }
  const n = points.length;
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const len = cum[i + 1] - cum[i];
    if (len <= 0) continue;
    if (sw <= cum[i + 1] || i === segCount - 1) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const t = Math.max(0, Math.min(1, (sw - cum[i]) / len));
      return {
        point: {
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
          z: a.z + t * (b.z - a.z),
        },
        tangent: {
          x: (b.x - a.x) / len,
          y: (b.y - a.y) / len,
          z: (b.z - a.z) / len,
        },
      };
    }
  }
  return null;
}

/**
 * Signed abscissa delta from `sFrom` to `sTo`. Open chains: the plain
 * difference. Closed chains: the shortest way around, in (-total/2, total/2].
 */
export function chainAbscissaDelta(measure, sFrom, sTo) {
  const { closed, total } = measure;
  let d = sTo - sFrom;
  if (!closed) return d;
  d = ((d % total) + total) % total;
  if (d > total / 2) d -= total;
  return d;
}
