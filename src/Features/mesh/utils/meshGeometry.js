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
