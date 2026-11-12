import { add, distance, dot, lengthSq, lerp, scale, sub } from "./vec3.js";

// Two lines cross when their segments pass within this distance (m) — the
// tolerance clipFaceByCutLines joins paths with.
export const CUT_LINE_CROSSING_TOLERANCE_M = 5e-3;

// A crossing this close (m) to a vertex of the line is that vertex.
const VERTEX_MERGE_M = 1e-3;

// Closest points of the segments [p1, q1] and [p2, q2] (Ericson, Real-Time
// Collision Detection §5.1.9). Returns { s, t, c1, c2 } — the parameters in
// [0, 1] and the points — or null for (nearly) parallel or degenerate
// segments: lines running along each other do not cross.
function closestSegmentPoints(p1, q1, p2, q2) {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = lengthSq(d1);
  const e = lengthSq(d2);
  if (a < 1e-12 || e < 1e-12) return null;
  const b = dot(d1, d2);
  const denom = a * e - b * b;
  if (denom < 1e-9 * a * e) return null;
  const c = dot(d1, r);
  const f = dot(d2, r);
  let s = Math.min(1, Math.max(0, (b * f - c * e) / denom));
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = Math.min(1, Math.max(0, -c / a));
  } else if (t > 1) {
    t = 1;
    s = Math.min(1, Math.max(0, (b - c) / a));
  }
  return { s, t, c1: add(p1, scale(d1, s)), c2: lerp(p2, q2, t) };
}

// Whether `point` lies on one of the world polylines `lines` (within
// `tolerance`, m): an end drawn on an existing cut line.
export function isPointOnLines(
  point,
  lines,
  tolerance = CUT_LINE_CROSSING_TOLERANCE_M
) {
  if (!point) return false;
  for (const line of lines || []) {
    if (!line) continue;
    for (let j = 0; j < line.length - 1; j++) {
      const d = sub(line[j + 1], line[j]);
      const l2 = lengthSq(d);
      const t =
        l2 < 1e-12
          ? 0
          : Math.min(1, Math.max(0, dot(sub(point, line[j]), d) / l2));
      if (distance(point, lerp(line[j], line[j + 1], t)) <= tolerance) {
        return true;
      }
    }
  }
  return false;
}

// Vertices added to the EXTENSION of a cut line where it crosses other cut
// lines, so that the crossing is a point of the line (« Stop », snap).
//
//   - points: [{x, y, z}] world polyline from extendCutLine — `derivedStart`
//     extension points at its head, `derivedEnd` at its tail;
//   - otherLines: [[{x, y, z}]] world polylines of the other cut lines
//     (their visible run).
//
// Only the segments of the extension are split (the segment joining a drawn
// end to its first extension point included): the drawn segments are left
// as the user drew them. The inserted point is taken ON the other line, and
// counts as an extension point. A crossing on an existing vertex of the line
// adds nothing.
//
// Returns { points, derivedStart, derivedEnd } (the input points are reused,
// not copied).
export default function insertCutLineCrossings({
  points,
  derivedStart = 0,
  derivedEnd = 0,
  otherLines = [],
  tolerance = CUT_LINE_CROSSING_TOLERANCE_M,
}) {
  const list = Array.isArray(points) ? points : [];
  const n = list.length;
  const unchanged = { points: list, derivedStart, derivedEnd };
  if (n < 2 || !otherLines?.length) return unchanged;
  if (derivedStart <= 0 && derivedEnd <= 0) return unchanged;

  const tailFrom = n - 1 - derivedEnd;
  const out = [];
  let addedStart = 0;
  let addedEnd = 0;

  for (let i = 0; i < n; i++) {
    out.push(list[i]);
    if (i === n - 1) break;
    const inHead = i < derivedStart;
    const inTail = i >= tailFrom;
    if (!inHead && !inTail) continue;

    const a = list[i];
    const b = list[i + 1];
    const hits = [];
    for (const line of otherLines) {
      if (!line || line.length < 2) continue;
      for (let j = 0; j < line.length - 1; j++) {
        const hit = closestSegmentPoints(a, b, line[j], line[j + 1]);
        if (!hit) continue;
        if (distance(hit.c1, hit.c2) > tolerance) continue;
        if (distance(hit.c2, a) <= VERTEX_MERGE_M) continue;
        if (distance(hit.c2, b) <= VERTEX_MERGE_M) continue;
        hits.push({ s: hit.s, point: hit.c2 });
      }
    }
    if (!hits.length) continue;

    hits.sort((h1, h2) => h1.s - h2.s);
    let last = null;
    for (const hit of hits) {
      // Two segments of one line meeting on the crossing: one point.
      if (last && distance(last, hit.point) <= VERTEX_MERGE_M) continue;
      out.push(hit.point);
      last = hit.point;
      if (inHead) addedStart += 1;
      else addedEnd += 1;
    }
  }

  if (!addedStart && !addedEnd) return unchanged;
  return {
    points: out,
    derivedStart: derivedStart + addedStart,
    derivedEnd: derivedEnd + addedEnd,
  };
}
