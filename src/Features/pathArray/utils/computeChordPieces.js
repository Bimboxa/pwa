// Relative import (with extension): keeps the file runnable by `node --test`.
import { circleFromThreePoints } from "../../geometry/utils/arcSampling.js";

// Path array (« Calepinage » of a POLYLINE): cuts a typed path (squares +
// square-circle-square arcs, see docs/annotations/ARCS.md) into pieces whose
// CHORD measures `step`.
//
//   - The path is first split into SMOOTH RUNS: a run ends at every angle
//     break (tangent turning by more than CORNER_ANGLE_RAD between two
//     elements). Tangent lines / arcs stay in the same run, so a closed
//     circle drawn with several arcs is one run.
//   - Inside a run, the walk goes chord by chord: from the current point, the
//     next one is the first point AHEAD on the path at distance `step`
//     (circle / segment and circle / arc intersections, exact). What is left
//     at the end of the run is a shorter piece (dropped under `minPiece`).
//
// Everything is in the same unit (pixels in the app). Pure: inputs are never
// mutated.
//
// Returns [{ start: {x, y}, end: {x, y}, length }] in path order.

const CORNER_ANGLE_RAD = (1 * Math.PI) / 180;
const EPS_T = 1e-9;
const MAX_PIECES = 5000;
const TWO_PI = Math.PI * 2;

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const norm2Pi = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

function makeLine(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const tangent = { x: dx / len, y: dy / len };
  return {
    start: a,
    end: b,
    tangentStart: tangent,
    tangentEnd: tangent,
    pointAt: (t) => ({ x: a.x + dx * t, y: a.y + dy * t }),
    // Params t in ]tMin, 1] where the element is at distance r from p.
    intersect: (p, r) => {
      const fx = a.x - p.x;
      const fy = a.y - p.y;
      const qa = dx * dx + dy * dy;
      const qb = 2 * (fx * dx + fy * dy);
      const qc = fx * fx + fy * fy - r * r;
      const disc = qb * qb - 4 * qa * qc;
      if (disc < 0) return [];
      const s = Math.sqrt(disc);
      return [(-qb - s) / (2 * qa), (-qb + s) / (2 * qa)];
    },
  };
}

function makeArc(s, c, e) {
  const circle = circleFromThreePoints(s, c, e);
  if (!circle || !Number.isFinite(circle.r) || !(circle.r > 0)) return null;
  const { center, r: radius } = circle;
  const a0 = Math.atan2(s.y - center.y, s.x - center.x);
  const a1 = Math.atan2(c.y - center.y, c.x - center.x);
  const a2 = Math.atan2(e.y - center.y, e.x - center.x);
  const d02 = norm2Pi(a2 - a0);
  const d01 = norm2Pi(a1 - a0);
  // Signed sweep from s to e passing through c.
  const sweep = d01 <= d02 ? d02 : d02 - TWO_PI;
  if (!(Math.abs(sweep) > 0)) return null;
  const sign = sweep > 0 ? 1 : -1;
  const tangentAt = (angle) => ({
    x: -Math.sin(angle) * sign,
    y: Math.cos(angle) * sign,
  });
  const pointAt = (t) => {
    const angle = a0 + sweep * t;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  };
  return {
    start: s,
    end: e,
    tangentStart: tangentAt(a0),
    tangentEnd: tangentAt(a0 + sweep),
    pointAt,
    intersect: (p, r) => {
      // circle (p, r) x circle (center, radius)
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const d = Math.hypot(dx, dy);
      if (!(d > 0)) return [];
      if (d > r + radius || d < Math.abs(r - radius)) return [];
      const along = (radius * radius - r * r + d * d) / (2 * d);
      const h2 = radius * radius - along * along;
      const h = h2 > 0 ? Math.sqrt(h2) : 0;
      const base = Math.atan2(dy, dx);
      const delta = Math.atan2(h, along);
      return [base - delta, base + delta].map((angle) => {
        let turned = sign > 0 ? norm2Pi(angle - a0) : norm2Pi(a0 - angle);
        // A hit on the very start of the arc can wrap to just under 2π.
        if (turned > TWO_PI - 1e-7) turned = 0;
        return turned / Math.abs(sweep);
      });
    },
  };
}

// Typed points -> ordered elements (lines and arcs).
function buildElements(points, closeLine) {
  let pts = points.filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (pts.length < 2) return [];
  const isCircle = (p) => p?.type === "circle";

  if (closeLine) {
    // A ring must start on a square point.
    const firstSquare = pts.findIndex((p) => !isCircle(p));
    if (firstSquare > 0)
      pts = [...pts.slice(firstSquare), ...pts.slice(0, firstSquare)];
    pts = [...pts, pts[0]];
  }

  const elements = [];
  let i = 0;
  while (i < pts.length - 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const c = pts[i + 2];
    if (isCircle(b) && c && !isCircle(c)) {
      const arc = makeArc(a, b, c);
      if (arc) elements.push(arc);
      else {
        // Degenerate arc (aligned / coincident points): two straight lines.
        const l1 = makeLine(a, b);
        const l2 = makeLine(b, c);
        if (l1) elements.push(l1);
        if (l2) elements.push(l2);
      }
      i += 2;
    } else {
      const line = makeLine(a, b);
      if (line) elements.push(line);
      i += 1;
    }
  }
  return elements;
}

function isCorner(prev, next) {
  const dot =
    prev.tangentEnd.x * next.tangentStart.x +
    prev.tangentEnd.y * next.tangentStart.y;
  return Math.acos(Math.max(-1, Math.min(1, dot))) > CORNER_ANGLE_RAD;
}

function buildRuns(elements, closeLine) {
  if (!elements.length) return [];
  let list = elements;
  if (closeLine && list.length > 1) {
    // Start the ring right after a corner so no smooth run is cut in two.
    const n = list.length;
    let startAt = -1;
    for (let k = 0; k < n; k++) {
      if (isCorner(list[(k + n - 1) % n], list[k])) {
        startAt = k;
        break;
      }
    }
    if (startAt > 0) list = [...list.slice(startAt), ...list.slice(0, startAt)];
  }
  const runs = [[list[0]]];
  for (let k = 1; k < list.length; k++) {
    if (isCorner(list[k - 1], list[k])) runs.push([list[k]]);
    else runs[runs.length - 1].push(list[k]);
  }
  return runs;
}

function walkRun(run, step, minPiece, out) {
  let current = run[0].start;
  let elementIndex = 0;
  let param = 0;
  const runEnd = run[run.length - 1].end;

  while (out.length < MAX_PIECES) {
    let found = null;
    for (let k = elementIndex; k < run.length && !found; k++) {
      const tMin = k === elementIndex ? param + EPS_T : -EPS_T;
      const candidates = run[k]
        .intersect(current, step)
        .filter((t) => Number.isFinite(t) && t > tMin && t <= 1 + EPS_T)
        .sort((a, b) => a - b);
      for (const t of candidates) {
        const tt = Math.min(1, Math.max(0, t));
        const point = run[k].pointAt(tt);
        // Guards the first crossing against a numerical echo of `current`.
        if (dist(current, point) < step * 0.5) continue;
        found = { elementIndex: k, param: tt, point };
        break;
      }
    }
    if (!found) break;
    out.push({ start: current, end: found.point, length: step });
    current = found.point;
    elementIndex = found.elementIndex;
    param = found.param;
  }

  const rest = dist(current, runEnd);
  if (rest > minPiece && out.length < MAX_PIECES)
    out.push({ start: current, end: runEnd, length: rest });
}

export default function computeChordPieces({
  points,
  closeLine = false,
  step,
  minPiece = 0,
}) {
  if (!Array.isArray(points) || !(step > 0)) return [];
  const elements = buildElements(points, Boolean(closeLine));
  const runs = buildRuns(elements, Boolean(closeLine));
  const out = [];
  for (const run of runs) walkRun(run, step, Math.max(minPiece, 0), out);
  return out;
}
