// Least-squares circular-arc fit through an arbitrary set of 2D points.
//
// Given the points of several short straight POLYLINE segments that together
// trace a curve, this fits the best circle (Kåsa algebraic least squares),
// then emits a `square → circle → square (→ circle → square …)` chain that the
// NodePolylineStatic renderer draws as a circular arc.
//
// The chain is split into N sub-arcs each spanning < 180° because the renderer
// hardcodes the SVG `large-arc-flag` to 0 (see NodePolylineStatic.jsx:280–316).
// Every chain point lies exactly on the fitted circle (endpoints are projected
// onto it), so the renderer's per-triplet circleFromThreePoints recompute
// reproduces the fitted circle faithfully.

const EPS = 1e-6;
const TWO_PI = Math.PI * 2;

function det3(m) {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function norm0to2pi(a) {
  let x = a % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x;
}

export default function fitCircleArcThroughPoints(points) {
  if (!Array.isArray(points)) return null;

  // Dedup with tolerance.
  const pts = [];
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (
      pts.some((q) => Math.abs(q.x - p.x) < EPS && Math.abs(q.y - p.y) < EPS)
    ) {
      continue;
    }
    pts.push({ x: p.x, y: p.y });
  }
  if (pts.length < 3) return null;

  // Kåsa fit: model x² + y² = a·x + b·y + c. Solve the 3×3 normal system
  //   [Sxx Sxy Sx] [a]   [Sxz]
  //   [Sxy Syy Sy] [b] = [Syz]
  //   [Sx  Sy  n ] [c]   [Sz ]
  const n = pts.length;
  let Sx = 0,
    Sy = 0,
    Sxx = 0,
    Syy = 0,
    Sxy = 0,
    Sxz = 0,
    Syz = 0,
    Sz = 0;
  for (const { x, y } of pts) {
    const z = x * x + y * y;
    Sx += x;
    Sy += y;
    Sxx += x * x;
    Syy += y * y;
    Sxy += x * y;
    Sxz += x * z;
    Syz += y * z;
    Sz += z;
  }

  const M = [
    [Sxx, Sxy, Sx],
    [Sxy, Syy, Sy],
    [Sx, Sy, n],
  ];
  const det = det3(M);
  if (Math.abs(det) < 1e-9) return null; // collinear / degenerate

  const a =
    det3([
      [Sxz, Sxy, Sx],
      [Syz, Syy, Sy],
      [Sz, Sy, n],
    ]) / det;
  const b =
    det3([
      [Sxx, Sxz, Sx],
      [Sxy, Syz, Sy],
      [Sx, Sz, n],
    ]) / det;
  const c =
    det3([
      [Sxx, Sxy, Sxz],
      [Sxy, Syy, Syz],
      [Sx, Sy, Sz],
    ]) / det;

  const cx = a / 2;
  const cy = b / 2;
  const r = Math.sqrt(Math.max(0, c + cx * cx + cy * cy));
  if (!(r > 0) || !Number.isFinite(r) || r > 1e5) return null;

  // Covered angular span = complement of the largest empty gap around the
  // circle (handles the ±π wrap).
  const angles = pts.map((p) => Math.atan2(p.y - cy, p.x - cx));
  const sorted = [...angles].sort((u, v) => u - v);
  let maxGap = -Infinity;
  let gapIdx = 0;
  for (let i = 0; i < n; i++) {
    const gap =
      i < n - 1
        ? sorted[i + 1] - sorted[i]
        : sorted[0] + TWO_PI - sorted[n - 1];
    if (gap > maxGap) {
      maxGap = gap;
      gapIdx = i;
    }
  }
  const startAngle = sorted[(gapIdx + 1) % n];
  const endAngle = sorted[gapIdx];
  const span = norm0to2pi(endAngle - startAngle);

  // Split into sub-arcs each < 180° (renderer assumes large-arc-flag = 0).
  const nSub = Math.max(1, Math.ceil(span / (Math.PI * 0.95)));
  const dTheta = span / nSub;

  const onCircle = (theta, type) => ({
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
    type,
  });

  const chainPoints = [];
  for (let k = 0; k < nSub; k++) {
    const t0 = startAngle + k * dTheta;
    chainPoints.push(onCircle(t0, "square"));
    chainPoints.push(onCircle(t0 + dTheta / 2, "circle"));
  }
  chainPoints.push(onCircle(startAngle + nSub * dTheta, "square"));

  return { chainPoints, center: { x: cx, y: cy }, r, span };
}
