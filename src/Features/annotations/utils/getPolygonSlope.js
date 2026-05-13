// Fits the best plane z = a*X + b*Y + c (least squares) over the polygon's
// vertices, where X/Y are in meters (image pixels scaled by meterByPx) and
// z is the per-vertex offsetTop (already in meters).
//
// Vertices with `isSliding: true` are excluded from the fit: they are derived
// (their position is recomputed at each commit, not user-controlled) and
// their `offsetTop` is not a real height sample.
//
// Returns { dirX, dirY, slopePct } or null when the slope is undefined or
// effectively zero (flat surface, degenerate plane, fewer than 3 points).
//
//   - (dirX, dirY): unit vector in image-pixel space pointing downhill,
//     i.e. -(a, b) normalized. Direction is invariant to uniform scaling,
//     so it can be applied directly to pixel coordinates.
//   - slopePct: |grad z| * 100 (rise/run as a percentage).
export default function getPolygonSlope({ points, meterByPx }) {
  if (!Array.isArray(points) || points.length < 3) return null;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;

  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let sumXX = 0;
  let sumXY = 0;
  let sumYY = 0;
  let sumXZ = 0;
  let sumYZ = 0;

  for (const p of points) {
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
    if (p.isSliding) continue;
    const X = p.x * meterByPx;
    const Y = p.y * meterByPx;
    const Z = p.offsetTop ?? 0;
    n += 1;
    sumX += X;
    sumY += Y;
    sumZ += Z;
    sumXX += X * X;
    sumXY += X * Y;
    sumYY += Y * Y;
    sumXZ += X * Z;
    sumYZ += Y * Z;
  }

  if (n < 3) return null;

  // Solve the 3x3 normal equations for [a, b, c] in:
  //   [ sumXX  sumXY  sumX ] [a]   [ sumXZ ]
  //   [ sumXY  sumYY  sumY ] [b] = [ sumYZ ]
  //   [ sumX   sumY   n    ] [c]   [ sumZ  ]
  const m11 = sumXX, m12 = sumXY, m13 = sumX;
  const m21 = sumXY, m22 = sumYY, m23 = sumY;
  const m31 = sumX,  m32 = sumY,  m33 = n;

  const det =
    m11 * (m22 * m33 - m23 * m32) -
    m12 * (m21 * m33 - m23 * m31) +
    m13 * (m21 * m32 - m22 * m31);

  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;

  const detA =
    sumXZ * (m22 * m33 - m23 * m32) -
    m12   * (sumYZ * m33 - m23 * sumZ) +
    m13   * (sumYZ * m32 - m22 * sumZ);
  const detB =
    m11   * (sumYZ * m33 - m23 * sumZ) -
    sumXZ * (m21 * m33 - m23 * m31) +
    m13   * (m21 * sumZ - sumYZ * m31);

  const a = detA / det;
  const b = detB / det;

  const grad = Math.hypot(a, b);
  if (!Number.isFinite(grad) || grad < 1e-6) return null;

  return {
    dirX: -a / grad,
    dirY: -b / grad,
    slopePct: grad * 100,
  };
}
