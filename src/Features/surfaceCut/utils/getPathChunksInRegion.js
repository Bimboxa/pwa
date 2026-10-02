// Pieces of a path drawn across a 2D region (a contour and its holes) that
// run strictly inside it, from boundary to boundary: the cuts the path makes
// in the region ("Couper une surface").
//
// loops: [contour, ...holes], each an open loop [{x, y}]. path: open
// polyline [{x, y}], in the same metric frame. tolerance: snap distance to
// the boundary (a path point closer than it is ON the boundary, a boundary
// point closer than it to a corner IS that corner).
// extendEnds: an end of the path stopping strictly inside the region is
// prolonged along its end segment up to the first boundary it meets — the
// guillotine: a short stroke inside a surface cuts it through.
//
// Returns { chunks, path } — chunks: [[{x, y}]], each starting and ending on
// the boundary and strictly inside in between; path: the (extended) path —
// or { error: "EMPTY_PATH" | "SELF_INTERSECTING" }.
export default function getPathChunksInRegion(
  loops,
  path,
  { tolerance = 1e-3, extendEnds = false } = {}
) {
  let points = dedupePath(path);
  if (points.length < 2 || !loops?.[0] || loops[0].length < 3) {
    return { error: "EMPTY_PATH" };
  }
  if (extendEnds) points = extendPathEnds(loops, points, { tolerance });
  if (isPathSelfIntersecting(points)) return { error: "SELF_INTERSECTING" };

  // Stations along the path: its vertices and its crossings with the
  // boundary, in walking order. Boundary stations sit exactly on it.
  const stations = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const onBoundary = locateOnBoundary(loops, p, tolerance);
    stations.push(
      onBoundary
        ? { x: onBoundary.x, y: onBoundary.y, boundary: true, key: i }
        : { x: p.x, y: p.y, boundary: false, key: i }
    );
    if (i === points.length - 1) continue;
    const a = p;
    const b = points[i + 1];
    for (const loop of loops) {
      for (let k = 0; k < loop.length; k++) {
        const hit = intersectSegments(
          a,
          b,
          loop[k],
          loop[(k + 1) % loop.length]
        );
        if (!hit || hit.u <= 1e-9 || hit.u >= 1 - 1e-9) continue;
        const snapped = locateOnBoundary(loops, hit, tolerance) ?? hit;
        stations.push({
          x: snapped.x,
          y: snapped.y,
          boundary: true,
          key: i + hit.u,
        });
      }
    }
  }
  stations.sort((s1, s2) => s1.key - s2.key);

  // Merge coincident stations (a crossing on a corner is hit by both of its
  // edges; a crossing next to a path vertex).
  const merged = [];
  for (const station of stations) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Math.hypot(last.x - station.x, last.y - station.y) <= tolerance
    ) {
      if (station.boundary && !last.boundary) {
        merged[merged.length - 1] = station;
      }
      continue;
    }
    merged.push(station);
  }

  // Between two boundary stations the path is wholly inside or wholly
  // outside the region.
  const chunks = [];
  let current = null;
  for (const station of merged) {
    if (current) current.push(station);
    if (!station.boundary) continue;
    if (current && isChunkInside(loops, current, tolerance)) {
      chunks.push(current.map(({ x, y }) => ({ x, y })));
    }
    current = [station];
  }
  return { chunks, path: points };
}

// The path with each end strictly inside the region prolonged along its end
// segment to the first boundary point ahead (unchanged when it meets none).
export function extendPathEnds(loops, path, { tolerance = 1e-3 } = {}) {
  const points = dedupePath(path);
  if (points.length < 2) return points;
  const isStrictlyInside = (p) =>
    isInsideRegion(loops, p) && distanceToBoundary(loops, p) > tolerance;

  const n = points.length;
  if (isStrictlyInside(points[0])) {
    const hit = castRay(loops, points[1], points[0], tolerance);
    if (hit) points[0] = hit;
  }
  if (isStrictlyInside(points[n - 1])) {
    const hit = castRay(loops, points[n - 2], points[n - 1], tolerance);
    if (hit) points[n - 1] = hit;
  }
  return points;
}

// True when two segments of the path cross or overlap (adjacent segments
// only overlap when the path doubles back on itself).
export function isPathSelfIntersecting(path) {
  const n = path?.length ?? 0;
  for (let i = 0; i < n - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (i + 2 < n) {
      const c = path[i + 2];
      const d1x = b.x - a.x;
      const d1y = b.y - a.y;
      const d2x = c.x - b.x;
      const d2y = c.y - b.y;
      const cross = d1x * d2y - d1y * d2x;
      const scale = Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y);
      if (Math.abs(cross) <= 1e-12 * scale && d1x * d2x + d1y * d2y < 0) {
        return true;
      }
    }
    for (let j = i + 2; j < n - 1; j++) {
      if (intersectSegments(a, b, path[j], path[j + 1])) return true;
    }
  }
  return false;
}

export function isInsideRegion(loops, p) {
  const [contour, ...holes] = loops;
  if (!pointInRing(p, contour)) return false;
  return !holes.some((hole) => pointInRing(p, hole));
}

export function distanceToBoundary(loops, p) {
  let best = Infinity;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const d = distanceToSegment(p, loop[i], loop[(i + 1) % loop.length]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function signedArea2d(loop) {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// Intersection of segments ab and cd (touching included): { u, v, x, y }
// with u along ab and v along cd, or null (parallel segments: null).
export function intersectSegments(a, b, c, d) {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-15) return null;
  const u = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const v = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
  const eps = 1e-9;
  if (u < -eps || u > 1 + eps || v < -eps || v > 1 + eps) return null;
  return { u, v, x: a.x + u * rx, y: a.y + u * ry };
}

// --- helpers

function dedupePath(path) {
  const points = [];
  for (const p of path || []) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
    const last = points[points.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 1e-9) continue;
    points.push({ x: p.x, y: p.y });
  }
  return points;
}

// A chunk (boundary → … → boundary) is a cut when it runs inside the region
// and is not a sliver hugging the boundary.
function isChunkInside(loops, chunk, tolerance) {
  if (chunk.length < 2) return false;
  const first = chunk[0];
  const last = chunk[chunk.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) <= tolerance) return false;
  const probes = chunk.slice(1, -1);
  for (let i = 0; i < chunk.length - 1; i++) {
    probes.push({
      x: (chunk[i].x + chunk[i + 1].x) / 2,
      y: (chunk[i].y + chunk[i + 1].y) / 2,
    });
  }
  let farthest = 0;
  for (const p of probes) {
    if (!isInsideRegion(loops, p)) return false;
    farthest = Math.max(farthest, distanceToBoundary(loops, p));
  }
  return farthest > tolerance;
}

// Boundary point (corner preferred) within tolerance of p, or null.
function locateOnBoundary(loops, p, tolerance) {
  let bestVertex = null;
  let bestEdge = null;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const dv = Math.hypot(p.x - a.x, p.y - a.y);
      if (dv <= tolerance && (!bestVertex || dv < bestVertex.distance)) {
        bestVertex = { x: a.x, y: a.y, distance: dv };
      }
      const proj = projectOnSegment(p, a, loop[(i + 1) % loop.length]);
      if (proj.t <= 0 || proj.t >= 1 || proj.distance > tolerance) continue;
      if (!bestEdge || proj.distance < bestEdge.distance) {
        bestEdge = { x: proj.x, y: proj.y, distance: proj.distance };
      }
    }
  }
  return bestVertex ?? bestEdge;
}

// First boundary point on the ray from `end` going away from `from`.
function castRay(loops, from, end, tolerance) {
  const dx = end.x - from.x;
  const dy = end.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  let best = null;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const c = loop[i];
      const d = loop[(i + 1) % loop.length];
      const sx = d.x - c.x;
      const sy = d.y - c.y;
      const denom = ux * sy - uy * sx;
      if (Math.abs(denom) < 1e-15) continue;
      const t = ((c.x - end.x) * sy - (c.y - end.y) * sx) / denom;
      const v = ((c.x - end.x) * uy - (c.y - end.y) * ux) / denom;
      if (t <= 1e-9 || v < -1e-9 || v > 1 + 1e-9) continue;
      if (!best || t < best.t) best = { t };
    }
  }
  if (!best) return null;
  const hit = { x: end.x + best.t * ux, y: end.y + best.t * uy };
  return locateOnBoundary(loops, hit, tolerance) ?? hit;
}

function projectOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { t, x, y, distance: Math.hypot(p.x - x, p.y - y) };
}

function distanceToSegment(p, a, b) {
  const { t, distance } = projectOnSegment(p, a, b);
  if (t <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  if (t >= 1) return Math.hypot(p.x - b.x, p.y - b.y);
  return distance;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}
