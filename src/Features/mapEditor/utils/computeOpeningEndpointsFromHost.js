// Shared math for opening placement and reflow: given a host segment (straight
// line or S-C-S arc) and the opening center abscissa measured from the
// reference vertex (segStart), compute the opening's two endpoints.
//
// Used by:
//   - computeOpeningSegmentPlacement (drawing preview / commit)
//   - TransientTopologyLayer (live reposition during host vertex drag)
//   - reflowOpeningsForHostService (db reflow on host geometry commit)

const TWO_PI = Math.PI * 2;

function normalizeAngle(a) {
  let res = a % TWO_PI;
  if (res < 0) res += TWO_PI;
  return res;
}

// Circle from 3 points. Returns { center, r, isCW } or null (colinear).
function getCircleFrom3Points(p0, p1, p2) {
  const x1 = p0.x,
    y1 = p0.y;
  const x2 = p1.x,
    y2 = p1.y;
  const x3 = p2.x,
    y3 = p2.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-9) return null;

  const s1 = x1 * x1 + y1 * y1;
  const s2 = x2 * x2 + y2 * y2;
  const s3 = x3 * x3 + y3 * y3;

  const ux = (s1 * (y2 - y3) + s2 * (y3 - y1) + s3 * (y1 - y2)) / D;
  const uy = (s1 * (x3 - x2) + s2 * (x1 - x3) + s3 * (x2 - x1)) / D;

  const center = { x: ux, y: uy };
  const r = Math.hypot(x1 - ux, y1 - uy);
  const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const isCW = cross > 0;

  return { center, r, isCW };
}

/**
 * Builds a parametric curve for a host segment: straight line A→B, or the
 * S-C-S arc A→B through `arcControl`. Abscissas (s) are curvilinear, measured
 * from A (the reference vertex).
 *
 * @returns {{
 *   len: number,
 *   pointAt: (s: number) => { x: number, y: number },
 *   project: (p: { x, y }) => { s: number, distance: number },
 * }}
 */
export function buildHostCurve(A, B, arcControl) {
  if (arcControl) {
    const circ = getCircleFrom3Points(A, arcControl, B);
    if (circ && circ.r > 0) {
      const { center, r, isCW } = circ;
      const angleStart = Math.atan2(A.y - center.y, A.x - center.x);
      const angleEnd = Math.atan2(B.y - center.y, B.x - center.x);
      // isCW arcs sweep in +angle direction, CCW in -angle direction
      // (same convention as getBestSnap's projectOnArc).
      const dir = isCW ? 1 : -1;
      const span = normalizeAngle(dir * (angleEnd - angleStart));
      const len = span * r;

      const pointAt = (s) => {
        const angle = angleStart + dir * (s / r);
        return {
          x: center.x + Math.cos(angle) * r,
          y: center.y + Math.sin(angle) * r,
        };
      };

      const project = (p) => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return { s: 0, distance: r };
        const angleAt = Math.atan2(dy, dx);
        const rel = normalizeAngle(dir * (angleAt - angleStart));
        if (rel <= span) {
          return { s: rel * r, distance: Math.abs(dist - r) };
        }
        // Outside the arc — clamp to the nearest endpoint.
        const dA = Math.hypot(p.x - A.x, p.y - A.y);
        const dB = Math.hypot(p.x - B.x, p.y - B.y);
        return dA < dB ? { s: 0, distance: dA } : { s: len, distance: dB };
      };

      return { len, pointAt, project };
    }
    // Degenerate arc → fall through to linear
  }

  const ux = B.x - A.x;
  const uy = B.y - A.y;
  const len = Math.hypot(ux, uy);
  const nx = len === 0 ? 0 : ux / len;
  const ny = len === 0 ? 0 : uy / len;

  const pointAt = (s) => ({ x: A.x + nx * s, y: A.y + ny * s });

  const project = (p) => {
    const s = Math.max(0, Math.min(len, (p.x - A.x) * nx + (p.y - A.y) * ny));
    const proj = pointAt(s);
    return { s, distance: Math.hypot(p.x - proj.x, p.y - proj.y) };
  };

  return { len, pointAt, project };
}

/**
 * Computes the opening's two endpoints on its host segment.
 *
 * The opening center sits at a FIXED curvilinear distance (hostDistancePx)
 * from the reference vertex segStartPx — stretching the wall from the other
 * end does not move the opening. The distance is only clamped when the
 * segment became too short on the reference side.
 *
 * @param {Object} args
 * @param {{x,y}} args.segStartPx - current position of the reference vertex
 * @param {{x,y}} args.segEndPx - current position of the other segment vertex
 * @param {number} args.hostDistancePx - opening center abscissa from segStart
 * @param {number} args.openingLengthPx - opening width along the wall
 * @param {{x,y}} [args.arcControlPx] - S-C-S middle control point (arc host)
 * @returns {{ p1: {x,y}, p2: {x,y}, fits: boolean, hostDistancePx: number }}
 */
export default function computeOpeningEndpointsFromHost({
  segStartPx,
  segEndPx,
  hostDistancePx,
  openingLengthPx,
  arcControlPx,
}) {
  const curve = buildHostCurve(segStartPx, segEndPx, arcControlPx);
  const L = openingLengthPx;

  if (!(L > 0) || curve.len < L) {
    // Opening no longer fits — it spans the whole segment.
    return {
      p1: { ...segStartPx },
      p2: { ...segEndPx },
      fits: false,
      hostDistancePx,
    };
  }

  const s = Math.max(L / 2, Math.min(curve.len - L / 2, hostDistancePx));

  return {
    p1: curve.pointAt(s - L / 2),
    p2: curve.pointAt(s + L / 2),
    fits: true,
    hostDistancePx: s,
  };
}
