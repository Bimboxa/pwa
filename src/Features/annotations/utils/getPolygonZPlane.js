// Fits the best plane z = a*X + b*Y + c (least squares) over the polygon's
// vertices, where X/Y are in METERS (pixel coords scaled by meterByPx) and
// z is the per-vertex value read from `key` (default "offsetTop"), already
// in meters.
//
// Returns { a, b, c } or null when the plane is undefined (fewer than 3 valid
// points, degenerate vertex distribution).
//
// For a strictly flat surface (all values equal), a = b = 0 and c = the
// constant value. The companion `getZAtXY` helper interpolates the plane at
// any (xPx, yPx) location.
export default function getPolygonZPlane({
  points,
  meterByPx,
  key = "offsetTop",
}) {
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
    const X = p.x * meterByPx;
    const Y = p.y * meterByPx;
    const Z = p[key] ?? 0;
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
  const m11 = sumXX,
    m12 = sumXY,
    m13 = sumX;
  const m21 = sumXY,
    m22 = sumYY,
    m23 = sumY;
  const m31 = sumX,
    m32 = sumY,
    m33 = n;

  const det =
    m11 * (m22 * m33 - m23 * m32) -
    m12 * (m21 * m33 - m23 * m31) +
    m13 * (m21 * m32 - m22 * m31);

  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) {
    // Degenerate vertex distribution (collinear). Fall back to constant plane
    // at the mean Z so callers can still query a finite altitude.
    return { a: 0, b: 0, c: sumZ / n };
  }

  const detA =
    sumXZ * (m22 * m33 - m23 * m32) -
    m12 * (sumYZ * m33 - m23 * sumZ) +
    m13 * (sumYZ * m32 - m22 * sumZ);
  const detB =
    m11 * (sumYZ * m33 - m23 * sumZ) -
    sumXZ * (m21 * m33 - m23 * m31) +
    m13 * (m21 * sumZ - sumYZ * m31);
  const detC =
    m11 * (m22 * sumZ - sumYZ * m32) -
    m12 * (m21 * sumZ - sumYZ * m31) +
    sumXZ * (m21 * m32 - m22 * m31);

  return {
    a: detA / det,
    b: detB / det,
    c: detC / det,
  };
}

// Evaluates plane z = a*X + b*Y + c at the given pixel coordinates.
// `plane` is the output of `getPolygonZPlane`. Result in meters.
export function getZAtXY(plane, xPx, yPx, meterByPx) {
  if (!plane || !Number.isFinite(meterByPx)) return 0;
  const X = xPx * meterByPx;
  const Y = yPx * meterByPx;
  return plane.a * X + plane.b * Y + plane.c;
}
