// Small geometry helpers shared by the mesh tool. All coordinates are plain
// {x, y} in the editor's world space (map pixels for POLYGON, elevation pixels
// for POLYLINE).

export function getBbox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points ?? []) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// Signed-area-independent polygon area (shoelace), absolute value.
export function polygonAreaPx(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// Area-weighted polygon centroid; falls back to the vertex average for
// degenerate (zero-area) polygons.
export function polygonCentroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const avg = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return { x: avg.x / points.length, y: avg.y / points.length };
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

// Extend a segment [p1, p2] by `dist` in both directions along its own
// direction — used to turn a finite cut line into a guillotine cut that fully
// crosses the polygon before clipping.
export function extendLine(p1, p2, dist) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [p1, p2];
  const ux = dx / len;
  const uy = dy / len;
  return [
    { x: p1.x - ux * dist, y: p1.y - uy * dist },
    { x: p2.x + ux * dist, y: p2.y + uy * dist },
  ];
}

// Unit normal of a segment (perpendicular to its direction).
export function segmentNormal(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 1 };
  return { x: -dy / len, y: dx / len };
}

// Build a cut line that spans the bbox (with a margin) for a given orientation
// at a fixed coordinate. VERTICAL → constant x; HORIZONTAL → constant y.
export function lineForBbox(orientation, value, bbox, margin = 0) {
  if (orientation === "HORIZONTAL") {
    return {
      p1: { x: bbox.minX - margin, y: value },
      p2: { x: bbox.maxX + margin, y: value },
    };
  }
  // VERTICAL (default)
  return {
    p1: { x: value, y: bbox.minY - margin },
    p2: { x: value, y: bbox.maxY + margin },
  };
}

// Ray-casting point-in-polygon test. `polygon` is [{x, y}] (no explicit closing
// point). Points exactly on an edge may report either side — fine for snapping.
export function pointInPolygon(pt, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y || 1e-12) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Intersection point of segment [a1, a2] with segment [b1, b2], or null if the
// segments don't cross within their extents (parallel/collinear → null).
export function segmentIntersection(a1, a2, b1, b2) {
  const r = { x: a2.x - a1.x, y: a2.y - a1.y };
  const s = { x: b2.x - b1.x, y: b2.y - b1.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null; // parallel
  const qp = { x: b1.x - a1.x, y: b1.y - a1.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * r.x, y: a1.y + t * r.y };
}

// Snap candidates (world space) for the line tools:
//   - every outline vertex;
//   - the endpoints of existing cut lines that lie inside the outline;
//   - the intersections of every cut line with the outline edges.
export function buildSnapCandidates({ outlinePoints, meshLines }) {
  const candidates = [];
  const poly = outlinePoints ?? [];
  poly.forEach((p, i) => {
    candidates.push({ id: p.id ?? `v-${i}`, x: p.x, y: p.y });
  });

  (meshLines ?? []).forEach((line) => {
    if (!line?.p1 || !line?.p2) return;
    // interior endpoints
    for (const which of ["p1", "p2"]) {
      const ep = line[which];
      if (pointInPolygon(ep, poly))
        candidates.push({ id: `${line.id}-${which}`, x: ep.x, y: ep.y });
    }
    // intersections with the outline edges
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const hit = segmentIntersection(line.p1, line.p2, a, b);
      if (hit)
        candidates.push({ id: `${line.id}-x${i}`, x: hit.x, y: hit.y });
    }
  });

  return candidates;
}

// Nearest candidate to `worldPos` within `radius` (world units), else null.
export function snapToCandidates(worldPos, candidates, radius) {
  let best = null;
  let bestD = radius;
  for (const c of candidates ?? []) {
    const d = Math.hypot(c.x - worldPos.x, c.y - worldPos.y);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
