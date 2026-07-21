// Bowyer-Watson Delaunay triangulation of a 2D point set. Returns triangle
// index triplets over the input array (input order preserved). O(n²) — fine
// for the shell DOME meshes (≤ ~1000 points).
//
// Not a constrained Delaunay: callers wanting specific edges preserved must
// sample those edges densely enough that no other point invades the
// sub-segments' diametral circles (see computeDomeSteinerField), and should
// sanity-check the result (e.g. covered planar area) before trusting it.
export default function delaunayTriangulate(points) {
  const n = points?.length ?? 0;
  if (n < 3) return null;

  // Super-triangle enclosing every point.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dMax = Math.max(dx, dy);
  if (!(dMax > 0)) return null;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Working vertex list = input points + 3 super-triangle vertices.
  const vx = new Float64Array(n + 3);
  const vy = new Float64Array(n + 3);
  for (let i = 0; i < n; i++) {
    vx[i] = points[i].x;
    vy[i] = points[i].y;
  }
  vx[n] = cx - 20 * dMax;
  vy[n] = cy - dMax;
  vx[n + 1] = cx + 20 * dMax;
  vy[n + 1] = cy - dMax;
  vx[n + 2] = cx;
  vy[n + 2] = cy + 20 * dMax;

  // Triangles as {a, b, c} (ccw not enforced; incircle handles orientation).
  let tris = [{ a: n, b: n + 1, c: n + 2 }];

  // Scale-aware degeneracy epsilon: EXACTLY cocircular point sets (regular
  // polygons — circles drawn as N-gons are the common case here) make the
  // incircle determinant hover around 0 with sign noise, which breaks the
  // cavity (non-star-shaped → overlapping triangles). Points within eps of a
  // circumcircle are treated as OUTSIDE — for truly cocircular sets any
  // triangulation is Delaunay, so this stays valid. det terms scale ~ dMax⁴.
  const EPS_CIRCLE = Math.max(1e-30, dMax ** 4 * 1e-11);

  const inCircumcircle = (t, px, py) => {
    const ax = vx[t.a] - px;
    const ay = vy[t.a] - py;
    const bx = vx[t.b] - px;
    const by = vy[t.b] - py;
    const cxx = vx[t.c] - px;
    const cyy = vy[t.c] - py;
    const det =
      (ax * ax + ay * ay) * (bx * cyy - cxx * by) -
      (bx * bx + by * by) * (ax * cyy - cxx * ay) +
      (cxx * cxx + cyy * cyy) * (ax * by - bx * ay);
    // Orientation of the triangle decides the sign convention.
    const orient =
      (vx[t.b] - vx[t.a]) * (vy[t.c] - vy[t.a]) -
      (vy[t.b] - vy[t.a]) * (vx[t.c] - vx[t.a]);
    return orient >= 0 ? det > EPS_CIRCLE : det < -EPS_CIRCLE;
  };

  for (let i = 0; i < n; i++) {
    const px = vx[i];
    const py = vy[i];

    // Bad triangles = those whose circumcircle contains the new point.
    const bad = [];
    const good = [];
    for (const t of tris) {
      if (inCircumcircle(t, px, py)) bad.push(t);
      else good.push(t);
    }
    if (bad.length === 0) {
      // Numerically stuck (duplicate/degenerate point) — skip it.
      continue;
    }

    // Cavity boundary = edges of bad triangles not shared by two of them.
    const edgeCount = new Map();
    const edgeKey = (u, v) => (u < v ? `${u}|${v}` : `${v}|${u}`);
    const addEdge = (u, v) => {
      const k = edgeKey(u, v);
      const e = edgeCount.get(k);
      if (e) e.count += 1;
      else edgeCount.set(k, { u, v, count: 1 });
    };
    for (const t of bad) {
      addEdge(t.a, t.b);
      addEdge(t.b, t.c);
      addEdge(t.c, t.a);
    }

    for (const { u, v, count } of edgeCount.values()) {
      if (count === 1) good.push({ a: u, b: v, c: i });
    }
    tris = good;
  }

  // Drop every triangle touching the super-triangle.
  const out = [];
  for (const t of tris) {
    if (t.a >= n || t.b >= n || t.c >= n) continue;
    out.push([t.a, t.b, t.c]);
  }
  return out.length > 0 ? out : null;
}
