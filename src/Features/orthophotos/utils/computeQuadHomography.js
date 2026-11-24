// Homography mapping the UNIT SQUARE onto a quadrilateral (closed form,
// Heckbert 1989): (0,0) -> q0, (1,0) -> q1, (1,1) -> q2, (0,1) -> q3.
// Returns a flat row-major Array(9) (same layout as photoPlans/utils/mat3),
// applied as x' = (h0 u + h1 v + h2) / (h6 u + h7 v + h8), or null when the
// quad is degenerate.

const EPS = 1e-12;

export default function computeQuadHomography(quad) {
  if (!Array.isArray(quad) || quad.length !== 4) return null;
  const [q0, q1, q2, q3] = quad;
  if (quad.some((p) => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) {
    return null;
  }

  const sx = q0.x - q1.x + q2.x - q3.x;
  const sy = q0.y - q1.y + q2.y - q3.y;
  const dx1 = q1.x - q2.x;
  const dx2 = q3.x - q2.x;
  const dy1 = q1.y - q2.y;
  const dy2 = q3.y - q2.y;

  const scale = Math.max(
    Math.abs(dx1),
    Math.abs(dx2),
    Math.abs(dy1),
    Math.abs(dy2)
  );
  const det = dx1 * dy2 - dx2 * dy1;
  if (!(scale > 0) || Math.abs(det) < EPS * scale * scale) return null;

  // Parallelogram: the mapping is affine (g = h = 0).
  const isAffine = Math.abs(sx) < EPS * scale && Math.abs(sy) < EPS * scale;
  const g = isAffine ? 0 : (sx * dy2 - dx2 * sy) / det;
  const h = isAffine ? 0 : (dx1 * sy - sx * dy1) / det;

  return [
    q1.x - q0.x + g * q1.x,
    q3.x - q0.x + h * q3.x,
    q0.x,
    q1.y - q0.y + g * q1.y,
    q3.y - q0.y + h * q3.y,
    q0.y,
    g,
    h,
    1,
  ];
}

// Dehomogenized application. Null on / beyond the line at infinity.
export function applyHomography(H, { x, y }) {
  const w = H[6] * x + H[7] * y + H[8];
  if (!(Math.abs(w) > EPS)) return null;
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}
