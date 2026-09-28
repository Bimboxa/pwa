import {
  circleFromThreePoints,
  expandArcsInPath,
  typeOf,
} from "./arcSampling.js";
import convexHull from "./convexHull.js";
import signedArea2 from "./signedArea2.js";
import simplifyPolylineRdp from "./simplifyPolylineRdp.js";

// Main axis of a polygon, as an open polyline in the same (pixel) space as
// the input ring. Used by "Ajouter une pente" to seed a guide line.
//
// - Near-convex shapes (rectangle, trapezoid, straight band): the longest
//   median of the minimum-area oriented bounding box, clipped to the ring.
//   For a rectangle this is exactly its longest median.
// - Other shapes (curved bands, L / U shapes, rings with holes): a raster
//   skeleton (Zhang-Suen thinning), pruned of its short spurs, reduced to its
//   longest path, RDP-simplified and extended to the contour at both ends.
//
// The raw axis is then made as simple as possible for a guide line: both
// ends snap to the middle of the polygon's end segments (caps) and leave /
// reach them orthogonally, and the path is replaced by the simplest fit
// within tolerance — a straight segment, one circular arc (S-C-S), a biarc
// (two tangent-continuous arcs), a chain of 2-5 straight / arc pieces, or a
// coarsely simplified polyline as a last resort.
//
// Returns [{x, y, type: "square" | "circle"}, ...] (>= 2 points; a "circle"
// point is an arc control point), first point = leftmost end (then topmost),
// or null when the input is degenerate.

const ARC_SAMPLES = 16;
const EPS = 1e-9;

export default function getPolygonMainAxisPolyline(points, options = {}) {
  const { cuts = [], gridSize = 160, convexityThreshold = 0.95 } = options;

  const ring = toRing(points);
  if (ring.length < 3) return null;
  const cutRings = (cuts ?? [])
    .map((c) => toRing(c?.points ?? c))
    .filter((r) => r.length >= 3);

  const area = Math.abs(signedArea2(ring)) / 2;
  if (area < EPS) return null;

  let axis = null;
  if (cutRings.length === 0) {
    const hull = convexHull(ring);
    const hullArea = Math.abs(signedArea2(hull)) / 2;
    if (hullArea > EPS && area / hullArea >= convexityThreshold) {
      axis = getObbMedian(ring, hull);
    }
  }
  if (!axis) {
    axis = getSkeletonAxis(ring, cutRings, { gridSize, area });
  }
  if (!axis) {
    axis = getObbMedian(ring, convexHull(ring));
  }
  if (!axis || axis.path.length < 2) return null;

  const { widthPx } = axis;
  const snapped = snapEndsToCapMidpoints(axis.path, points, widthPx);
  const fitted = fitSmoothGuideLine(snapped, widthPx);
  if (!fitted || fitted.length < 2) return null;
  return orient(fitted);
}

// ---------------------------------------------------------------------------
// ring helpers
// ---------------------------------------------------------------------------

function toRing(points) {
  if (!Array.isArray(points)) return [];
  const finite = points.filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (finite.length < 3) return [];
  const expanded = expandArcsInPath(finite, ARC_SAMPLES, true);
  const out = [];
  for (const p of expanded) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS)
      continue;
    out.push({ x: p.x, y: p.y });
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) out.pop();
  }
  return out;
}

function ringPerimeter(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    const intersects =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Intersections of the ray/line `origin + dir * t` with the ring edges.
// Returns the sorted list of t values (dir is expected to be unit length).
function lineRingIntersections(origin, dir, ring) {
  const ts = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < EPS) continue;
    const ax = a.x - origin.x;
    const ay = a.y - origin.y;
    const t = (ax * ey - ay * ex) / denom;
    const s = (ax * dir.y - ay * dir.x) / denom;
    if (s >= -EPS && s <= 1 + EPS) ts.push(t);
  }
  return ts.sort((u, v) => u - v);
}

function orient(axis) {
  const a = axis[0];
  const b = axis[axis.length - 1];
  const reverse = b.x < a.x - EPS || (Math.abs(b.x - a.x) <= EPS && b.y < a.y);
  return reverse ? [...axis].reverse() : axis;
}

// ---------------------------------------------------------------------------
// OBB median (near-convex shapes)
// ---------------------------------------------------------------------------

function getObbMedian(ring, hull) {
  if (!hull || hull.length < 2) return null;
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < EPS) continue;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const v = { x: -u.y, y: u.x };
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const pu = p.x * u.x + p.y * u.y;
      const pv = p.x * v.x + p.y * v.y;
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv;
      if (pv > maxV) maxV = pv;
    }
    const obbArea = (maxU - minU) * (maxV - minV);
    if (!best || obbArea < best.area - EPS) {
      best = { area: obbArea, u, v, minU, maxU, minV, maxV };
    }
  }
  if (!best) return null;

  const { u, v, minU, maxU, minV, maxV } = best;
  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  const center = { x: u.x * cu + v.x * cv, y: u.y * cu + v.y * cv };
  const longIsU = maxU - minU >= maxV - minV;
  const dir = longIsU ? u : v;
  const halfExtent = (longIsU ? maxU - minU : maxV - minV) / 2;

  const ts = lineRingIntersections(center, dir, ring);
  let tMin;
  let tMax;
  if (ts.length >= 2) {
    tMin = ts[0];
    tMax = ts[ts.length - 1];
  } else {
    tMin = -halfExtent;
    tMax = halfExtent;
  }
  if (tMax - tMin < EPS) return null;
  return {
    path: [
      { x: center.x + dir.x * tMin, y: center.y + dir.y * tMin },
      { x: center.x + dir.x * tMax, y: center.y + dir.y * tMax },
    ],
    widthPx: longIsU ? maxV - minV : maxU - minU,
  };
}

// ---------------------------------------------------------------------------
// Raster skeleton (other shapes)
// ---------------------------------------------------------------------------

function getSkeletonAxis(ring, cutRings, { gridSize, area }) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < EPS || h < EPS) return null;
  const cell = Math.max(w, h) / gridSize;
  // 1-cell margin on each side so the thinning never touches the border.
  const cols = Math.ceil(w / cell) + 2;
  const rows = Math.ceil(h / cell) + 2;
  const toX = (c) => minX + (c - 1 + 0.5) * cell;
  const toY = (r) => minY + (r - 1 + 0.5) * cell;

  const mask = new Uint8Array(rows * cols);
  let filled = 0;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const p = { x: toX(c), y: toY(r) };
      if (!pointInRing(p, ring)) continue;
      let inCut = false;
      for (const cr of cutRings) {
        if (pointInRing(p, cr)) {
          inCut = true;
          break;
        }
      }
      if (inCut) continue;
      mask[r * cols + c] = 1;
      filled++;
    }
  }
  if (filled < 3) return null;

  zhangSuenThin(mask, rows, cols);

  // Band width estimate: twice the median clearance (distance to the
  // contour) of the skeleton cells. Falls back on 2 * area / perimeter.
  const widthPx =
    estimateWidthFromClearance(mask, rows, cols, toX, toY, [
      ring,
      ...cutRings,
    ]) || (2 * area) / Math.max(ringPerimeter(ring), EPS);
  const widthCells = widthPx / cell;
  // End spurs of a band run from the axis to the corners: ~0.7 * width long.
  const pruneLen = Math.max(3, Math.round(1.1 * widthCells));
  pruneSpurs(mask, rows, cols, pruneLen);

  const pathCells = longestPath(mask, rows, cols);
  if (!pathCells || pathCells.length < 2) return null;

  const rings = [ring, ...cutRings];
  const raw = trimDriftingEnds(
    pathCells.map((idx) => ({
      x: toX(idx % cols),
      y: toY(Math.floor(idx / cols)),
    })),
    rings,
    widthPx
  );
  // Extend on the raw path (local tangent over the last cells) before the
  // simplification, whose long chords would point away from a curved axis.
  const extended = extendEndsToRing(raw, ring, {
    tangentCells: Math.max(3, Math.round(widthCells / 2)),
    maxDistance: widthPx,
  });
  // Light simplification only: the fit below needs the dense shape.
  const path = simplifyPolylineRdp(extended, 0.5 * cell);
  if (path.length < 2) return null;
  return { path, widthPx };
}

function pointToSegmentDistance(p, a, b) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len2 = ex * ex + ey * ey;
  let t = 0;
  if (len2 > EPS) {
    t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t));
}

// Median clearance of the skeleton cells to the contour rings, times two.
function estimateWidthFromClearance(mask, rows, cols, toX, toY, rings) {
  const clearances = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = { x: toX(i % cols), y: toY(Math.floor(i / cols)) };
    let best = Infinity;
    for (const r of rings) {
      for (let k = 0; k < r.length; k++) {
        const d = pointToSegmentDistance(p, r[k], r[(k + 1) % r.length]);
        if (d < best) best = d;
      }
    }
    if (Number.isFinite(best)) clearances.push(best);
  }
  if (!clearances.length) return 0;
  clearances.sort((a, b) => a - b);
  return 2 * clearances[Math.floor(clearances.length / 2)];
}

// Zhang-Suen thinning, in place. mask cells are 0/1; border cells stay 0.
function zhangSuenThin(mask, rows, cols) {
  const at = (r, c) => mask[r * cols + c];
  const toDelete = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      toDelete.length = 0;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          if (!at(r, c)) continue;
          const p2 = at(r - 1, c);
          const p3 = at(r - 1, c + 1);
          const p4 = at(r, c + 1);
          const p5 = at(r + 1, c + 1);
          const p6 = at(r + 1, c);
          const p7 = at(r + 1, c - 1);
          const p8 = at(r, c - 1);
          const p9 = at(r - 1, c - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
          if (a !== 1) continue;
          const m1 = step === 0 ? p2 * p4 * p6 : p2 * p4 * p8;
          const m2 = step === 0 ? p4 * p6 * p8 : p2 * p6 * p8;
          if (m1 !== 0 || m2 !== 0) continue;
          toDelete.push(r * cols + c);
        }
      }
      if (toDelete.length) {
        changed = true;
        for (const idx of toDelete) mask[idx] = 0;
      }
    }
  }
}

function neighbors(idx, mask, rows, cols) {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
      const j = rr * cols + cc;
      if (mask[j]) out.push(j);
    }
  }
  return out;
}

// Removes end branches shorter than `pruneLen` cells that end on a junction.
// A chain running from one endpoint to another is the whole skeleton and is
// never pruned.
function pruneSpurs(mask, rows, cols, pruneLen) {
  for (let pass = 0; pass < 5; pass++) {
    const endpoints = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] && neighbors(i, mask, rows, cols).length === 1)
        endpoints.push(i);
    }
    let removed = false;
    for (const start of endpoints) {
      if (!mask[start]) continue;
      const chain = [start];
      let prev = -1;
      let cur = start;
      let endsOnJunction = false;
      while (chain.length <= pruneLen) {
        const ns = neighbors(cur, mask, rows, cols).filter((n) => n !== prev);
        if (ns.length === 0) break; // other endpoint: whole skeleton
        if (ns.length > 1) {
          endsOnJunction = true;
          break;
        }
        // A neighbour that is itself adjacent to the previous cell is part of
        // a thick corner, treat it as a junction-free step.
        prev = cur;
        cur = ns[0];
        if (neighbors(cur, mask, rows, cols).length > 2) {
          endsOnJunction = true;
          break;
        }
        chain.push(cur);
      }
      if (endsOnJunction && chain.length <= pruneLen) {
        for (const idx of chain) mask[idx] = 0;
        removed = true;
      }
    }
    if (!removed) break;
  }
}

// Longest shortest-path (graph diameter) over the skeleton cells, with
// euclidean step costs. Returns the list of cell indices.
function longestPath(mask, rows, cols) {
  const cells = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) cells.push(i);
  if (cells.length === 0) return null;
  if (cells.length === 1) return null;

  const stepCost = (a, b) => {
    const dr = Math.floor(a / cols) - Math.floor(b / cols);
    const dc = (a % cols) - (b % cols);
    return dr && dc ? Math.SQRT2 : 1;
  };

  function dijkstra(source) {
    const dist = new Map();
    const parent = new Map();
    const visited = new Set();
    dist.set(source, 0);
    let far = source;
    while (true) {
      let cur = -1;
      let best = Infinity;
      for (const [k, d] of dist) {
        if (!visited.has(k) && d < best) {
          best = d;
          cur = k;
        }
      }
      if (cur < 0) break;
      visited.add(cur);
      if (best > dist.get(far)) far = cur;
      for (const n of neighbors(cur, mask, rows, cols)) {
        const nd = best + stepCost(cur, n);
        if (nd < (dist.get(n) ?? Infinity)) {
          dist.set(n, nd);
          parent.set(n, cur);
        }
      }
    }
    return { far, parent };
  }

  // Start from an endpoint when there is one so the first sweep lands on the
  // far end of the main chain.
  let seed = cells[0];
  for (const c of cells) {
    if (neighbors(c, mask, rows, cols).length === 1) {
      seed = c;
      break;
    }
  }
  const first = dijkstra(seed);
  const second = dijkstra(first.far);
  const path = [];
  let cur = second.far;
  while (cur !== undefined) {
    path.push(cur);
    cur = second.parent.get(cur);
  }
  return path.reverse();
}

// Near an end cap the thinned skeleton drifts towards one corner (the
// medial axis forks there). Drop the trailing cells whose clearance to the
// contour falls well below half the band width, so the end tangent is taken
// on the true axis.
function trimDriftingEnds(path, rings, widthPx) {
  if (path.length < 3) return path;
  const clearance = (p) => {
    let best = Infinity;
    for (const r of rings) {
      for (let k = 0; k < r.length; k++) {
        const d = pointToSegmentDistance(p, r[k], r[(k + 1) % r.length]);
        if (d < best) best = d;
      }
    }
    return best;
  };
  const minClearance = 0.8 * (widthPx / 2);
  let start = 0;
  let end = path.length - 1;
  while (end - start >= 2 && clearance(path[start]) < minClearance) start++;
  while (end - start >= 2 && clearance(path[end]) < minClearance) end--;
  return path.slice(start, end + 1);
}

// Pushes both ends of the path onto the ring along the local end tangents.
// The tangent is taken over the last `tangentCells` points; the extension is
// skipped when the contour is farther than `maxDistance` (the end would be
// running along a side wall rather than towards an end cap).
function extendEndsToRing(path, ring, { tangentCells, maxDistance }) {
  const out = path.map((p) => ({ x: p.x, y: p.y }));
  const n = out.length;
  const extend = (endIdx, backIdx) => {
    const end = out[endIdx];
    const back = out[backIdx];
    const len = Math.hypot(end.x - back.x, end.y - back.y);
    if (len < EPS) return;
    const dir = { x: (end.x - back.x) / len, y: (end.y - back.y) / len };
    const ts = lineRingIntersections(end, dir, ring).filter((t) => t > EPS);
    if (!ts.length) return;
    const t = ts[0];
    if (t > maxDistance) return;
    out[endIdx] = { x: end.x + dir.x * t, y: end.y + dir.y * t };
  };
  const k = Math.min(tangentCells, n - 1);
  extend(0, k);
  extend(n - 1, n - 1 - k);
  return out;
}

// ---------------------------------------------------------------------------
// Guide line simplification
// ---------------------------------------------------------------------------

// Max angle between an imposed end tangent and the fitted curve there.
const ALIGN_COS = Math.cos((4 * Math.PI) / 180);
const ARC_SAMPLES_FIT = 24;

function unit(v) {
  const len = Math.hypot(v.x, v.y);
  return len < EPS ? null : { x: v.x / len, y: v.y / len };
}

function aligned(t, v) {
  const u = unit(v);
  if (!t || !u) return false;
  return t.x * u.x + t.y * u.y >= ALIGN_COS;
}

// Moves each end of the path to the middle of the original polygon segment
// it lands on, when that segment is an end cap: straight (no arc control
// point), short (<= 2.5 * band width) and roughly perpendicular to the axis.
// Also returns the cap normals as the travel direction the guide line must
// have there (leaving the start cap, reaching the end cap orthogonally).
function snapEndsToCapMidpoints(path, originalPoints, widthPx) {
  const out = path.map((p) => ({ x: p.x, y: p.y }));
  const result = { path: out, startTangent: null, endTangent: null };
  const pts = (originalPoints || []).filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  const n = pts.length;
  if (n < 3 || path.length < 2) return result;
  const segments = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (typeOf(a) === "circle" || typeOf(b) === "circle") continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < EPS) continue;
    segments.push({ a, b, len });
  }
  const snapTol = Math.max(2, 0.05 * widthPx);
  // Returns the travel direction at that end (pointing away from the cap
  // into the shape) or null when no cap was found.
  const snap = (endIdx, innerIdx) => {
    const end = out[endIdx];
    const inner = out[innerIdx];
    const t = unit({ x: end.x - inner.x, y: end.y - inner.y });
    if (!t) return null;
    let best = null;
    for (const seg of segments) {
      const d = pointToSegmentDistance(end, seg.a, seg.b);
      if (d > snapTol) continue;
      if (seg.len > 2.5 * widthPx) continue;
      const sx = (seg.b.x - seg.a.x) / seg.len;
      const sy = (seg.b.y - seg.a.y) / seg.len;
      if (Math.abs(sx * t.x + sy * t.y) > 0.7) continue;
      if (!best || d < best.d) best = { d, seg, sx, sy };
    }
    if (!best) return null;
    out[endIdx] = {
      x: (best.seg.a.x + best.seg.b.x) / 2,
      y: (best.seg.a.y + best.seg.b.y) / 2,
    };
    // Cap normal pointing into the shape (against the outgoing tangent t).
    let nx = -best.sy;
    let ny = best.sx;
    if (nx * t.x + ny * t.y > 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  };
  const k = Math.min(3, out.length - 1);
  result.startTangent = snap(0, k);
  const endInward = snap(out.length - 1, out.length - 1 - k);
  // Travel direction when reaching the end cap = opposite of its inward normal.
  result.endTangent = endInward ? { x: -endInward.x, y: -endInward.y } : null;
  return result;
}

function cumulativeLengths(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(
      cum[i - 1] +
        Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    );
  }
  return cum;
}

function pointAtLength(path, cum, target) {
  if (target <= 0) return { x: path[0].x, y: path[0].y };
  const total = cum[cum.length - 1];
  if (target >= total) {
    const last = path[path.length - 1];
    return { x: last.x, y: last.y };
  }
  let i = 1;
  while (i < cum.length && cum[i] < target) i++;
  const a = path[i - 1];
  const b = path[i];
  const span = cum[i] - cum[i - 1];
  const f = span > EPS ? (target - cum[i - 1]) / span : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Sub-path between two arc-length positions (interpolated end points).
function slicePath(path, cum, from, to) {
  const out = [pointAtLength(path, cum, from)];
  for (let i = 0; i < path.length; i++) {
    if (cum[i] > from + EPS && cum[i] < to - EPS) out.push(path[i]);
  }
  out.push(pointAtLength(path, cum, to));
  return out;
}

// Local travel direction of the path at one of its ends.
function pathEndTangent(path, atStart) {
  const n = path.length;
  const k = Math.min(3, n - 1);
  return atStart
    ? unit({ x: path[k].x - path[0].x, y: path[k].y - path[0].y })
    : unit({
        x: path[n - 1].x - path[n - 1 - k].x,
        y: path[n - 1].y - path[n - 1 - k].y,
      });
}

// Points of the S-C-S arc a -> c -> b (c = control point on the arc).
function sampleArc(a, c, b, samples = ARC_SAMPLES_FIT) {
  const circ = circleFromThreePoints(a, c, b);
  if (!circ || circ.r < EPS) return [a, b];
  const { center, r } = circ;
  const ang = (p) => Math.atan2(p.y - center.y, p.x - center.x);
  const a0 = ang(a);
  const TWO_PI = 2 * Math.PI;
  const ccwTo = (p) => (((ang(p) - a0) % TWO_PI) + TWO_PI) % TWO_PI;
  const sweepB = ccwTo(b);
  const sweepC = ccwTo(c);
  // Go counter-clockwise when the control point lies on that side.
  const sweep = sweepC <= sweepB ? sweepB : sweepB - TWO_PI;
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const t = a0 + (sweep * i) / samples;
    out.push({ x: center.x + r * Math.cos(t), y: center.y + r * Math.sin(t) });
  }
  return out;
}

function pointToPolylineDistance(p, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const d = pointToSegmentDistance(p, poly[i - 1], poly[i]);
    if (d < best) best = d;
  }
  return poly.length === 1
    ? Math.hypot(p.x - poly[0].x, p.y - poly[0].y)
    : best;
}

// Symmetric max distance between the path piece and a candidate polyline.
function deviation(piece, candidate) {
  let max = 0;
  for (const p of piece) {
    const d = pointToPolylineDistance(p, candidate);
    if (d > max) max = d;
  }
  for (const q of candidate) {
    const d = pointToPolylineDistance(q, piece);
    if (d > max) max = d;
  }
  return max;
}

// Expands typed points (S / C) into a dense polyline for the deviation test.
function sampleTyped(start, typed) {
  const pts = [start, ...typed];
  const out = [{ x: start.x, y: start.y }];
  let i = 0;
  while (i < pts.length - 1) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    if (p1.type === "circle" && pts[i + 2]) {
      const arc = sampleArc(p0, p1, pts[i + 2]);
      for (let k = 1; k < arc.length; k++) out.push(arc[k]);
      i += 2;
    } else {
      out.push({ x: p1.x, y: p1.y });
      i += 1;
    }
  }
  return out;
}

// Arc leaving `a` along the unit tangent `t` and reaching `b`. Returns the
// S-C-S control point and the travel direction at `b`, or null when a, t and
// b are collinear (a straight segment does the job).
function oneTangentArc(a, t, b) {
  const nrm = { x: -t.y, y: t.x };
  const w = { x: b.x - a.x, y: b.y - a.y };
  const wn = w.x * nrm.x + w.y * nrm.y;
  const w2 = w.x * w.x + w.y * w.y;
  if (w2 < EPS || Math.abs(wn) < 1e-6 * Math.sqrt(w2)) return null;
  const rs = w2 / (2 * wn); // signed radius along nrm
  const center = { x: a.x + rs * nrm.x, y: a.y + rs * nrm.y };
  const r = Math.abs(rs);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const toMid = unit({ x: mid.x - center.x, y: mid.y - center.y });
  if (!toMid) return null;
  // Minor arc only (a semicircle or more is never a sensible guide line).
  const dotAB =
    (a.x - center.x) * (b.x - center.x) + (a.y - center.y) * (b.y - center.y);
  if (dotAB < -r * r * 0.999) return null;
  const control = { x: center.x + r * toMid.x, y: center.y + r * toMid.y };
  // Rotational sense at a, then the tangent at b in the same sense.
  const sigma = Math.sign((a.x - center.x) * t.y - (a.y - center.y) * t.x);
  const rb = { x: b.x - center.x, y: b.y - center.y };
  const endTangent = unit({ x: -sigma * rb.y, y: sigma * rb.x });
  return { control, endTangent };
}

// Biarc from a (tangent t0) to b (tangent t1): two tangent-continuous arcs
// (equal tangent-polygon legs). Returns typed points after `a`.
function biarc(a, t0, b, t1) {
  const v = { x: b.x - a.x, y: b.y - a.y };
  const v2 = v.x * v.x + v.y * v.y;
  if (v2 < EPS) return null;
  const ts = { x: t0.x + t1.x, y: t0.y + t1.y };
  const dot = t0.x * t1.x + t0.y * t1.y;
  const qa = 2 * dot - 2;
  const qb = -2 * (v.x * ts.x + v.y * ts.y);
  const qc = v2;
  let d;
  if (Math.abs(qa) < 1e-9) {
    if (Math.abs(qb) < 1e-9) return null;
    d = -qc / qb;
  } else {
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const d1 = (-qb + sq) / (2 * qa);
    const d2 = (-qb - sq) / (2 * qa);
    d = Math.min(...[d1, d2].filter((x) => x > EPS));
    if (!Number.isFinite(d)) return null;
  }
  const q0 = { x: a.x + d * t0.x, y: a.y + d * t0.y };
  const q1 = { x: b.x - d * t1.x, y: b.y - d * t1.y };
  const j = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
  const typed = [];
  const arc1 = oneTangentArc(a, t0, j);
  if (arc1) typed.push({ ...arc1.control, type: "circle" });
  typed.push({ x: j.x, y: j.y, type: "square" });
  // Second arc built backwards from b (tangent -t1) so it ends exactly on b.
  const arc2 = oneTangentArc(b, { x: -t1.x, y: -t1.y }, j);
  if (arc2) typed.push({ ...arc2.control, type: "circle" });
  typed.push({ x: b.x, y: b.y, type: "square" });
  return typed;
}

// Simplest description of one piece (typed points after its start) whose
// deviation from the piece stays within tol, honouring the imposed end
// tangents when given. Preference: a really straight segment (deviation
// <= tol / 3), then a single arc, then a straight segment within tol, then
// a biarc.
function fitPiece(piece, tol, startTangent, endTangent) {
  const a = piece[0];
  const b = piece[piece.length - 1];
  const chord = { x: b.x - a.x, y: b.y - a.y };
  const dev = (typed) => deviation(piece, sampleTyped(a, typed));

  let straight = null;
  if (
    (!startTangent || aligned(startTangent, chord)) &&
    (!endTangent || aligned(endTangent, chord))
  ) {
    straight = [{ x: b.x, y: b.y, type: "square" }];
  }
  const straightDev = straight ? dev(straight) : Infinity;
  if (straightDev <= tol / 3) return straight;

  let arc = null;
  if (startTangent) {
    const fit = oneTangentArc(a, startTangent, b);
    if (fit && (!endTangent || aligned(endTangent, fit.endTangent))) {
      arc = [
        { ...fit.control, type: "circle" },
        { x: b.x, y: b.y, type: "square" },
      ];
    }
  } else if (endTangent) {
    const fit = oneTangentArc(b, { x: -endTangent.x, y: -endTangent.y }, a);
    if (fit) {
      arc = [
        { ...fit.control, type: "circle" },
        { x: b.x, y: b.y, type: "square" },
      ];
    }
  } else {
    const cum = cumulativeLengths(piece);
    const m = pointAtLength(piece, cum, cum[cum.length - 1] / 2);
    const circ = circleFromThreePoints(a, m, b);
    if (circ && circ.r > EPS) {
      const toM = unit({ x: m.x - circ.center.x, y: m.y - circ.center.y });
      if (toM) {
        arc = [
          {
            x: circ.center.x + circ.r * toM.x,
            y: circ.center.y + circ.r * toM.y,
            type: "circle",
          },
          { x: b.x, y: b.y, type: "square" },
        ];
      }
    }
  }
  if (arc && dev(arc) <= tol) return arc;
  if (straight && straightDev <= tol) return straight;

  if (startTangent && endTangent) {
    const bi = biarc(a, startTangent, b, endTangent);
    if (bi && dev(bi) <= tol) return bi;
  }
  return null;
}

// Splits the path into k = 1..5 equal-length pieces and keeps the first k
// where every piece fits (first / last pieces with the cap tangents).
// Falls back on a coarse RDP polyline.
function fitSmoothGuideLine({ path, startTangent, endTangent }, widthPx) {
  if (path.length < 2) return null;
  const tol = Math.max(1, 0.15 * widthPx);
  const cum = cumulativeLengths(path);
  const total = cum[cum.length - 1];
  if (total < EPS) return null;
  const t0 = startTangent || pathEndTangent(path, true);
  const t1 = endTangent || pathEndTangent(path, false);

  for (let k = 1; k <= 5; k++) {
    const start = path[0];
    const typed = [{ x: start.x, y: start.y, type: "square" }];
    let ok = true;
    for (let i = 0; i < k; i++) {
      const piece = slicePath(
        path,
        cum,
        (total * i) / k,
        (total * (i + 1)) / k
      );
      const fit = fitPiece(
        piece,
        tol,
        i === 0 ? t0 : null,
        i === k - 1 ? t1 : null
      );
      if (!fit) {
        ok = false;
        break;
      }
      typed.push(...fit);
    }
    if (ok) return typed;
  }

  return simplifyPolylineRdp(path, 2 * tol).map((p) => ({
    x: p.x,
    y: p.y,
    type: "square",
  }));
}
