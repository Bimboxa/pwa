/**
 * Closest polygon with only right angles (rectilinear in its own rotated
 * frame) to the given ring / polyline.
 *
 * Unlike `orthogonalizePolyline` (which snaps the segments close to the
 * dominant axes and leaves the others untouched), every segment is forced
 * on one of the two axes, so chamfered corners and pixel jogs of a detected
 * contour collapse into clean 90° corners.
 *
 * 1. dominant orientation = the edge direction (mod 90°) minimising the
 *    length-weighted angular deviation of all edges, refined by the mean
 *    deviation of the well-aligned edges;
 * 2. in the rotated frame, each edge is H or V (its dominant component);
 * 3. consecutive edges of the same class merge into one run, carried by the
 *    line at the length-weighted mean of their midpoints;
 * 4. runs shorter than `minEdge` are dropped (their two neighbours merge);
 * 5. vertices = intersections of consecutive run lines, rotated back.
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {Object} [options]
 * @param {boolean} [options.closed=true]
 * @param {number} [options.minEdge] - Runs shorter than this are removed.
 *   Defaults to max(2, 1.5% of the bbox diagonal).
 * @returns {Array<{x: number, y: number}>|null} null when no right-angle
 *   polygon can be fitted (too few points, single direction...).
 */
export default function fitRightAnglePolygon(points, options = {}) {
  const { closed = true } = options;

  const n = points?.length ?? 0;
  if (n < (closed ? 3 : 2)) return null;

  // edges

  const edgeCount = closed ? n : n - 1;
  const edges = [];
  for (let i = 0; i < edgeCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    edges.push({ a, b, len, angle: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  if (edges.length < 2) return null;

  // dominant orientation

  const theta = findDominantAngle(edges);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const toLocal = (p) => ({
    x: p.x * cos + p.y * sin,
    y: -p.x * sin + p.y * cos,
  });
  const toWorld = (p) => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  });

  // runs: { isH, pos, weight } — pos is y for an H run, x for a V run.

  let runs = [];
  for (const edge of edges) {
    const a = toLocal(edge.a);
    const b = toLocal(edge.b);
    const isH = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const pos = isH ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    const last = runs[runs.length - 1];
    if (last && last.isH === isH) mergeInto(last, pos, edge.len);
    else runs.push({ isH, pos, weight: edge.len });
  }
  if (closed && runs.length > 1 && runs[0].isH === runs.at(-1).isH) {
    const tail = runs.pop();
    mergeInto(runs[0], tail.pos, tail.weight);
  }

  const minRuns = closed ? 4 : 2;
  if (runs.length < minRuns) return null;

  const start = toLocal(points[0]);
  const end = toLocal(points[n - 1]);

  // drop the short runs, shortest first

  const minEdge =
    options.minEdge ?? Math.max(2, 0.015 * getBboxDiagonal(points));

  while (runs.length >= minRuns + 2) {
    let shortest = -1;
    let shortestLen = minEdge;
    const from = closed ? 0 : 1;
    const to = closed ? runs.length : runs.length - 1;
    for (let i = from; i < to; i++) {
      const prev = runs[(i - 1 + runs.length) % runs.length];
      const next = runs[(i + 1) % runs.length];
      const len = Math.abs(next.pos - prev.pos);
      if (len < shortestLen) {
        shortestLen = len;
        shortest = i;
      }
    }
    if (shortest < 0) break;

    const prevIdx = (shortest - 1 + runs.length) % runs.length;
    const nextIdx = (shortest + 1) % runs.length;
    mergeInto(runs[prevIdx], runs[nextIdx].pos, runs[nextIdx].weight);
    runs = runs.filter((_, i) => i !== shortest && i !== nextIdx);
  }

  // vertices

  const corner = (r1, r2) =>
    r1.isH ? { x: r2.pos, y: r1.pos } : { x: r1.pos, y: r2.pos };
  const project = (p, run) =>
    run.isH ? { x: p.x, y: run.pos } : { x: run.pos, y: p.y };

  const local = [];
  if (closed) {
    // vertex i sits between run i-1 and run i (same order as the input).
    for (let i = 0; i < runs.length; i++) {
      local.push(corner(runs[(i - 1 + runs.length) % runs.length], runs[i]));
    }
  } else {
    local.push(project(start, runs[0]));
    for (let i = 1; i < runs.length; i++) {
      local.push(corner(runs[i - 1], runs[i]));
    }
    local.push(project(end, runs.at(-1)));
  }

  return local.map(toWorld);
}

// ─── helpers ────────────────────────────────────────────────────────

const HALF_PI = Math.PI / 2;

// Signed deviation of `angle` from the orthogonal grid of base `theta`,
// in [-45°, 45°].
function gridDeviation(angle, theta) {
  const d = angle - theta;
  return d - Math.round(d / HALF_PI) * HALF_PI;
}

function findDominantAngle(edges) {
  let best = 0;
  let bestScore = Infinity;
  for (const candidate of edges) {
    let score = 0;
    for (const edge of edges) {
      score += edge.len * Math.abs(gridDeviation(edge.angle, candidate.angle));
    }
    if (score < bestScore) {
      bestScore = score;
      best = candidate.angle;
    }
  }

  // refine with the well-aligned edges (< 10°)
  let sum = 0;
  let weight = 0;
  for (const edge of edges) {
    const dev = gridDeviation(edge.angle, best);
    if (Math.abs(dev) > Math.PI / 18) continue;
    sum += edge.len * dev;
    weight += edge.len;
  }
  return weight > 0 ? best + sum / weight : best;
}

function mergeInto(run, pos, weight) {
  const total = run.weight + weight;
  run.pos = (run.pos * run.weight + pos * weight) / total;
  run.weight = total;
}

function getBboxDiagonal(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}
