// findPolylineIntersections
//
// Crossing points between the main rings of two POLYLINE / POLYGON
// annotations, in PIXEL space. Each ring is given as its point refs
// (`{id, type?}`, the raw db order) plus a pixel resolver, so the same helper
// serves the resolved annotations of React and the raw db rows of a service.
//
// Arcs (square → circle → square triplets) are sampled into chords to find the
// candidate crossings, then every hit touching an arc is refined on the exact
// circle (circle / line or circle / circle intersection) so the returned point
// sits on the true curve, not on the chord. Hits are deduplicated: a crossing
// landing on a vertex shows up on the two chords sharing it.
//
// Pure, no mutation of the inputs.

import { intersectSegments } from "Features/surfaceCut/utils/getPathChunksInRegion";

import { typeOf, circleFromThreePoints, sampleArcPoints } from "./arcSampling";

const DEFAULT_ARC_SAMPLES = 16;
const DEDUPE_EPS_PX = 1e-3;

/**
 * Expand a ring of point refs into chords, each one remembering the raw
 * segment it comes from (`rawStartIdx` = index of the segment start in
 * `refs`, the value `splitArcOnInsert` expects) and the circle of its arc when
 * it samples one. Mirrors the S-C-S walk of `expandArcsInPath`: the first
 * half of an arc maps to the S index, the second half to the C index.
 *
 * @param {Array<{id:string,type?:string}>} refs
 * @param {(id:string)=>({x:number,y:number}|undefined)} getPx
 * @param {boolean} closed
 * @param {number} [samples]
 * @returns {Array<{a:{x,y}, b:{x,y}, rawStartIdx:number, arc:{center,r}|null}>}
 */
export function expandRefsToChords(
  refs,
  getPx,
  closed,
  samples = DEFAULT_ARC_SAMPLES
) {
  const n = refs?.length ?? 0;
  if (n < 2) return [];
  const get = closed ? (k) => refs[((k % n) + n) % n] : (k) => refs[k];
  const pxOf = (ref) => (ref ? getPx(ref.id) : undefined);
  const chords = [];
  const pushChord = (a, b, rawStartIdx, arc) => {
    if (!a || !b) return;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) return;
    chords.push({ a, b, rawStartIdx, arc });
  };

  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const r0 = get(i);
    const r1 = get(i + 1);
    const r2 = get(i + 2);
    const isArc =
      r1 &&
      r2 &&
      typeOf(r0) !== "circle" &&
      typeOf(r1) === "circle" &&
      typeOf(r2) !== "circle";

    if (isArc) {
      const p0 = pxOf(r0);
      const p1 = pxOf(r1);
      const p2 = pxOf(r2);
      const circ = p0 && p1 && p2 ? circleFromThreePoints(p0, p1, p2) : null;
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const cross =
          (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
        const isCW = cross > 0;
        const idx0 = ((i % n) + n) % n;
        const idx1 = (((i + 1) % n) + n) % n;
        const arc = { center: circ.center, r: circ.r };
        let prev = p0;
        for (const s of sampleArcPoints(
          p0,
          p1,
          circ.center,
          circ.r,
          isCW,
          samples
        )) {
          pushChord(prev, s, idx0, arc);
          prev = s;
        }
        for (const s of sampleArcPoints(
          p1,
          p2,
          circ.center,
          circ.r,
          isCW,
          samples
        )) {
          pushChord(prev, s, idx1, arc);
          prev = s;
        }
        i += 2;
        consumed += 2;
        continue;
      }
    }

    if (closed || i < n - 1) {
      pushChord(pxOf(r0), pxOf(r1), ((i % n) + n) % n, null);
    }
    i += 1;
    consumed += 1;
  }
  return chords;
}

// Intersections of a circle with the infinite line through a → b.
function circleLineIntersections(circle, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - circle.center.x;
  const fy = a.y - circle.center.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - circle.r * circle.r;
  if (A < 1e-18) return [];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  const ts =
    disc === 0 ? [-B / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
  return ts.map((t) => ({ x: a.x + t * dx, y: a.y + t * dy }));
}

// Intersections of two circles.
function circleCircleIntersections(c1, c2) {
  const dx = c2.center.x - c1.center.x;
  const dy = c2.center.y - c1.center.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return [];
  if (d > c1.r + c2.r + 1e-9 || d < Math.abs(c1.r - c2.r) - 1e-9) return [];
  const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
  const h2 = c1.r * c1.r - a * a;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const mx = c1.center.x + (a * dx) / d;
  const my = c1.center.y + (a * dy) / d;
  const ox = (-dy * h) / d;
  const oy = (dx * h) / d;
  return h === 0
    ? [{ x: mx, y: my }]
    : [
        { x: mx + ox, y: my + oy },
        { x: mx - ox, y: my - oy },
      ];
}

function projectOnCircle(circle, p) {
  const dx = p.x - circle.center.x;
  const dy = p.y - circle.center.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return p;
  return {
    x: circle.center.x + (dx / d) * circle.r,
    y: circle.center.y + (dy / d) * circle.r,
  };
}

function nearest(candidates, p) {
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// Move a chord / chord hit onto the exact curves it approximates.
function refineHit(hit, chordA, chordB) {
  const arcA = chordA.arc;
  const arcB = chordB.arc;
  if (!arcA && !arcB) return hit;
  let candidates = [];
  if (arcA && arcB) candidates = circleCircleIntersections(arcA, arcB);
  else if (arcA) candidates = circleLineIntersections(arcA, chordB.a, chordB.b);
  else candidates = circleLineIntersections(arcB, chordA.a, chordA.b);
  // Keep a candidate only when it stays near the chord pair it came from (the
  // exact curves may also cross far away, on the other side of the circle).
  const reach =
    Math.hypot(chordA.b.x - chordA.a.x, chordA.b.y - chordA.a.y) +
    Math.hypot(chordB.b.x - chordB.a.x, chordB.b.y - chordB.a.y);
  const close = candidates.filter(
    (c) => Math.hypot(c.x - hit.x, c.y - hit.y) <= reach
  );
  return nearest(close, hit) ?? projectOnCircle(arcA ?? arcB, hit);
}

/**
 * @param {{refs:Array, getPx:Function, closed:boolean}} ringA
 * @param {{refs:Array, getPx:Function, closed:boolean}} ringB
 * @param {{samples?:number, epsPx?:number}} [options]
 * @returns {Array<{x:number,y:number}>} crossing points, pixel space, deduplicated
 */
export default function findPolylineIntersections(ringA, ringB, options = {}) {
  const { samples = DEFAULT_ARC_SAMPLES, epsPx = DEDUPE_EPS_PX } = options;
  const chordsA = expandRefsToChords(
    ringA.refs,
    ringA.getPx,
    ringA.closed,
    samples
  );
  const chordsB = expandRefsToChords(
    ringB.refs,
    ringB.getPx,
    ringB.closed,
    samples
  );
  const hits = [];
  for (const ca of chordsA) {
    for (const cb of chordsB) {
      const raw = intersectSegments(ca.a, ca.b, cb.a, cb.b);
      if (!raw) continue;
      const hit = refineHit({ x: raw.x, y: raw.y }, ca, cb);
      if (!Number.isFinite(hit.x) || !Number.isFinite(hit.y)) continue;
      if (hits.some((h) => Math.hypot(h.x - hit.x, h.y - hit.y) < epsPx))
        continue;
      hits.push(hit);
    }
  }
  return hits;
}
