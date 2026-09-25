// "Joindre" (JOIN_ANNOTATIONS) tool — pure geometry.
//
// Given the RESOLVED (pixel-space) annotations of a base map and a selection
// rectangle, find the wall ENDS (first / last vertex of an open POLYLINE or
// STRIP) lying inside the rectangle and compute where each end must move,
// ALONG ITS OWN END SEGMENT, so the walls connect cleanly:
//
//   - Corner (two ends): the "penetrating" wall X (thinner band, tie → the
//     end currently closest to the centerline intersection) is extended until
//     its whole thickness sits inside the other wall Y's band, its outer
//     corner flush with Y's far edge (covers the corner, no wedge gap). Y is
//     then extended / shortened so its shallowest corner enters X's band by
//     1 cm (JOIN_OVERLAP_M).
//   - T (one end + a wall crossing the rectangle): the end enters the host
//     band by 1 cm the same way; the host is untouched.
//   - Near-parallel ends: both ends are pulled to the midpoint between them
//     (projected on their own line).
//
// Band model: for a wall direction d (unit) the LEFT normal is n = (-d.y,
// d.x) — the convention of offsetPolylineAsPolygons / getStripDistancePx. A
// POLYLINE band is centred ([-w/2, +w/2]); a STRIP band is one-sided,
// [min(0, dist), max(0, dist)] with dist signed by stripOrientation, expressed
// along the PATH direction. An end at the FIRST vertex walks the path
// backwards, so its band interval is mirrored.
//
// The input points are never mutated. No alias imports: this module is unit
// tested with `node --test`.

export const JOIN_OVERLAP_M = 0.01;

// Below this |sin(angle)| two ends are treated as parallel.
const PARALLEL_SIN_EPS = 0.05;

const EPS = 1e-9;

// helpers

const isFinitePoint = (p) =>
  Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

const unit = (from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: dx / len, y: dy / len };
};

const leftNormal = (d) => ({ x: -d.y, y: d.x });
const dot = (u, v) => u.x * v.x + u.y * v.y;
const cross = (u, v) => u.x * v.y - u.y * v.x;
const add = (p, d, t) => ({ x: p.x + d.x * t, y: p.y + d.y * t });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

// Intersection of the infinite lines p + t·d and q + u·e. Returns null when
// (near) parallel.
const lineIntersection = (p, d, q, e) => {
  const den = cross(d, e);
  if (Math.abs(den) < EPS) return null;
  const t = cross({ x: q.x - p.x, y: q.y - p.y }, e) / den;
  return add(p, d, t);
};

// Same as isOpeningAnnotation (Features/annotations/utils) — inlined so this
// module stays alias-import free.
const isOpening = (a) =>
  a?.drawingShape === "OPENING" ||
  (Boolean(a?.isOpening) && a?.points?.length === 2);

const makeInRect = (rect) => {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  return (p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
};

// Proper / touching segment intersection test (orientation based).
const orient = (a, b, c) => {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (v > EPS) return 1;
  if (v < -EPS) return -1;
  return 0;
};
const onSegment = (a, b, c) =>
  Math.min(a.x, b.x) - EPS <= c.x &&
  c.x <= Math.max(a.x, b.x) + EPS &&
  Math.min(a.y, b.y) - EPS <= c.y &&
  c.y <= Math.max(a.y, b.y) + EPS;
const segmentsIntersect = (a, b, c, d) => {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
};

const makeSegmentCrossesRect = (rect) => {
  const inRect = makeInRect(rect);
  const tl = { x: rect.x, y: rect.y };
  const tr = { x: rect.x + rect.width, y: rect.y };
  const br = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bl = { x: rect.x, y: rect.y + rect.height };
  const edges = [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ];
  return (a, b) =>
    inRect(a) ||
    inRect(b) ||
    edges.some(([e0, e1]) => segmentsIntersect(a, b, e0, e1));
};

// Band interval of a wall along the LEFT normal of its path direction.
const getPathBand = (annotation, meterByPx) => {
  const {
    strokeWidth,
    strokeWidthUnit,
    type,
    stripOrientation = 1,
  } = annotation;
  if (strokeWidthUnit !== "CM") return null;
  const w = (Number(strokeWidth) * 0.01) / meterByPx;
  if (!(w > 0)) return null;
  if (type === "STRIP") {
    const d = w * (stripOrientation < 0 ? -1 : 1);
    return [Math.min(0, d), Math.max(0, d)];
  }
  return [-w / 2, w / 2];
};

const mirrorBand = (band) => [-band[1], -band[0]];
const bandWidth = (band) => band[1] - band[0];

// Move wall `x`'s end so its whole thickness sits inside wall `y`'s band, its
// outer corner flush with y's far edge. Returns the new end position.
const penetrateFully = (x, y, I) => {
  const nX = leftNormal(x.dir);
  const nY = leftNormal(y.dir);
  const a = dot(x.dir, nY);
  const b = dot(nX, nY);
  const corners = [x.band[0] * b, x.band[1] * b];
  const s =
    a > 0
      ? (y.band[1] - Math.max(...corners)) / a
      : (y.band[0] - Math.min(...corners)) / a;
  return add(I, x.dir, s);
};

// Move wall `y`'s end so its shallowest corner enters wall `x`'s band by
// `overlapPx`, without letting its deepest corner leave x's far edge. When
// `xEnd` (x's own end position) is given, x's band is FINITE: it stops at
// the end cap through xEnd, perpendicular to x.dir — both corners of y must
// also stay `overlapPx` behind that cap, otherwise y's outer corner pokes out
// past x's cap and leaves a wedge gap at the corner. t is the signed
// distance along y.dir from the centerline intersection I; larger t = deeper.
const enterBand = (y, x, I, overlapPx, xEnd = null) => {
  const nX = leftNormal(x.dir);
  const nY = leftNormal(y.dir);
  const a = dot(y.dir, nX);
  const b = dot(nY, nX);
  let lo = -Infinity;
  let hi = Infinity;
  const addLower = (v) => {
    lo = Math.max(lo, v);
  };
  const addUpper = (v) => {
    hi = Math.min(hi, v);
  };

  // Lateral: offset(t) = t·a + o·b must stay inside x's band, with the
  // overlap margin on the near edge (the one y meets first).
  const min = x.band[0] + (a > 0 ? overlapPx : 0);
  const max = x.band[1] - (a < 0 ? overlapPx : 0);
  for (const o of y.band) {
    const c = o * b;
    if (a > 0) {
      addLower((min - c) / a);
      addUpper((max - c) / a);
    } else {
      addLower((max - c) / a);
      addUpper((min - c) / a);
    }
  }

  // Cap: along(t) = (I − xEnd)·x.dir + t·g + o·h must be ≤ −overlapPx.
  if (xEnd) {
    const base = dot({ x: I.x - xEnd.x, y: I.y - xEnd.y }, x.dir);
    const g = dot(y.dir, x.dir);
    const h = dot(nY, x.dir);
    if (Math.abs(g) >= EPS) {
      for (const o of y.band) {
        const rhs = -overlapPx - base - o * h;
        if (g > 0) addUpper(rhs / g);
        else addLower(rhs / g);
      }
    }
  }

  // Shallowest end satisfying every constraint; when they conflict, never
  // poke out (upper bound wins).
  const t = lo <= hi ? lo : hi;
  return add(I, y.dir, t);
};

const projectOnLine = (m, p, d) =>
  add(p, d, dot({ x: m.x - p.x, y: m.y - p.y }, d));

const joinCorner = (e1, e2, overlapPx) => {
  const sinT = Math.abs(cross(e1.dir, e2.dir));
  const I =
    sinT >= PARALLEL_SIN_EPS
      ? lineIntersection(e1.point, e1.dir, e2.point, e2.dir)
      : null;
  if (!I) {
    const m = {
      x: (e1.point.x + e2.point.x) / 2,
      y: (e1.point.y + e2.point.y) / 2,
    };
    return [
      { end: e1, pos: projectOnLine(m, e1.point, e1.dir) },
      { end: e2, pos: projectOnLine(m, e2.point, e2.dir) },
    ];
  }
  const w1 = bandWidth(e1.band);
  const w2 = bandWidth(e2.band);
  let x = e1;
  let y = e2;
  if (
    w2 < w1 - EPS ||
    (Math.abs(w2 - w1) <= EPS && dist(e2.point, I) < dist(e1.point, I))
  ) {
    x = e2;
    y = e1;
  }
  const xPos = penetrateFully(x, y, I);
  return [
    { end: x, pos: xPos },
    { end: y, pos: enterBand(y, x, I, overlapPx, xPos) },
  ];
};

// T junction: `end` enters the host segment's band by overlapPx. Returns the
// new end position or null when the lines are parallel.
const joinT = (end, host, overlapPx) => {
  const sinT = Math.abs(cross(end.dir, host.dir));
  if (sinT < PARALLEL_SIN_EPS) return null;
  const I = lineIntersection(end.point, end.dir, host.a, host.dir);
  if (!I) return null;
  return enterBand(end, host, I, overlapPx);
};

// main

export default function computeJoinAnnotationEnds({
  annotations,
  rect,
  meterByPx,
}) {
  const skipped = [];
  if (!(meterByPx > 0)) return { moves: [], skipped, reason: "NO_SCALE" };
  if (!rect || !Array.isArray(annotations))
    return { moves: [], skipped, reason: "NO_END" };

  const overlapPx = JOIN_OVERLAP_M / meterByPx;
  const inRect = makeInRect(rect);
  const segmentCrossesRect = makeSegmentCrossesRect(rect);

  // 1. Eligible walls.
  const walls = [];
  for (const a of annotations) {
    if (!a || (a.type !== "POLYLINE" && a.type !== "STRIP")) continue;
    if (a.closeLine || isOpening(a)) continue;
    const points = (a.points || []).filter(isFinitePoint);
    if (points.length < 2) continue;
    const first = points[0];
    const last = points[points.length - 1];
    if (a.type === "STRIP" && dist(first, last) < EPS) continue;
    const band = getPathBand(a, meterByPx);
    if (!band) {
      skipped.push({ annotationId: a.id, reason: "PX_WIDTH" });
      continue;
    }
    walls.push({ id: a.id, points, band });
  }

  // 2. Ends inside the rectangle.
  const ends = [];
  for (const wall of walls) {
    const { points } = wall;
    const n = points.length;
    const first = points[0];
    const last = points[n - 1];
    if (first.id && inRect(first)) {
      const dir = unit(points[1], first);
      if (dir)
        ends.push({
          wallId: wall.id,
          pointId: first.id,
          point: first,
          dir,
          band: mirrorBand(wall.band),
          segmentKey: `${wall.id}::0`,
        });
    }
    if (last.id && inRect(last)) {
      const dir = unit(points[n - 2], last);
      if (dir)
        ends.push({
          wallId: wall.id,
          pointId: last.id,
          point: last,
          dir,
          band: wall.band,
          segmentKey: `${wall.id}::${n - 2}`,
        });
    }
  }
  if (ends.length === 0) return { moves: [], skipped, reason: "NO_END" };

  // 3. Greedy pairing of the closest ends (never both ends of one segment).
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      if (ends[i].segmentKey === ends[j].segmentKey) continue;
      pairs.push({ i, j, d: dist(ends[i].point, ends[j].point) });
    }
  }
  pairs.sort((p, q) => p.d - q.d);
  const used = new Set();
  const placements = [];
  for (const { i, j } of pairs) {
    if (used.has(i) || used.has(j)) continue;
    used.add(i);
    used.add(j);
    placements.push(...joinCorner(ends[i], ends[j], overlapPx));
  }

  // 4. Leftover ends → T junction against a crossing segment of another wall.
  const leftovers = ends.filter((_, k) => !used.has(k));
  for (const end of leftovers) {
    let best = null;
    for (const wall of walls) {
      if (wall.id === end.wallId) continue;
      const { points } = wall;
      for (let k = 0; k < points.length - 1; k++) {
        const a = points[k];
        const b = points[k + 1];
        if (!segmentCrossesRect(a, b)) continue;
        const dir = unit(a, b);
        if (!dir) continue;
        const host = { a, b, dir, band: wall.band };
        const I = lineIntersection(end.point, end.dir, a, dir);
        if (!I) continue;
        // The intersection must fall on the host segment (band tolerance).
        const tol = bandWidth(wall.band);
        const u = dot({ x: I.x - a.x, y: I.y - a.y }, dir);
        if (u < -tol || u > dist(a, b) + tol) continue;
        const along = Math.abs(
          dot({ x: I.x - end.point.x, y: I.y - end.point.y }, end.dir)
        );
        if (!best || along < best.along) best = { host, along };
      }
    }
    if (!best) continue;
    const pos = joinT(end, best.host, overlapPx);
    if (pos) placements.push({ end, pos });
  }

  const moves = placements
    .filter(({ pos }) => isFinitePoint(pos))
    .map(({ end, pos }) => ({
      annotationId: end.wallId,
      pointId: end.pointId,
      x: pos.x,
      y: pos.y,
    }));

  return {
    moves,
    skipped,
    reason: moves.length === 0 ? "NO_TARGET" : undefined,
  };
}
