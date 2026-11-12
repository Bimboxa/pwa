import { add, copy, distance, dot, lengthSq, scale, sub } from "./vec3.js";

// Distance from `p` to the segment [a, b].
export function distanceToSegment(p, a, b) {
  const ab = sub(b, a);
  const len2 = lengthSq(ab);
  if (len2 < 1e-18) return distance(p, a);
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / len2));
  return distance(p, add(a, scale(ab, t)));
}

// True when `p` lies on the segment [prev, next] within `tolerance`.
function isCollinear(prev, p, next, tolerance) {
  return distanceToSegment(p, prev, next) <= tolerance;
}

// Drops the points lying on the straight line between their neighbors.
// `closed`: the ring has no repeated closing point and wraps around.
function simplify(points, closed, tolerance) {
  let out = points.slice();
  let changed = true;
  while (changed && out.length > (closed ? 3 : 2)) {
    changed = false;
    const n = out.length;
    const from = closed ? 0 : 1;
    const to = closed ? n : n - 1;
    for (let i = from; i < to; i++) {
      const prev = out[(i - 1 + n) % n];
      const next = out[(i + 1) % n];
      if (isCollinear(prev, out[i], next, tolerance)) {
        out = [...out.slice(0, i), ...out.slice(i + 1)];
        changed = true;
        break;
      }
    }
  }
  return out;
}

// Polylines of a section graph (buildSectionGraph): every connected
// component is chained into its lines.
//   - a component whose nodes all have 2 distinct neighbors is one CLOSED
//     loop (the section of a closed solid): `closed: true`, the last point
//     repeats the first one;
//   - otherwise the component is cut at its ends (1 neighbor) and junctions
//     (3+ neighbors: a wall standing on a slab) into open chains.
// Doubled edges (overlapping collinear segments) count once; collinear
// points are simplified (`tolerance`, metres).
//
// Returns [{ points: [{x, y, z}], closed, componentIndex }].
export default function chainSectionGraph(graph, { tolerance = 1e-4 } = {}) {
  const nodes = graph?.nodes;
  if (!nodes?.size) return [];

  // Distinct neighbor keys per node.
  const adjacency = new Map();
  for (const [key, node] of nodes) {
    const unique = new Set();
    for (const { key: other } of node.neighbors) {
      if (other !== key && nodes.has(other)) unique.add(other);
    }
    adjacency.set(key, [...unique]);
  }
  const positionOf = (key) => copy(nodes.get(key).position);
  const edgeId = (ka, kb) => (ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`);

  const lines = [];
  const seen = new Set();
  let componentIndex = 0;

  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    // Connected component of `start`.
    const component = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const key = stack.pop();
      component.push(key);
      for (const other of adjacency.get(key)) {
        if (seen.has(other)) continue;
        seen.add(other);
        stack.push(other);
      }
    }
    if (component.length < 2) continue;

    const breaks = component.filter((key) => adjacency.get(key).length !== 2);
    if (breaks.length === 0) {
      // Pure ring.
      const ring = [component[0]];
      let prev = null;
      let current = component[0];
      for (let guard = 0; guard <= component.length; guard++) {
        const [n0, n1] = adjacency.get(current);
        const next = n0 !== prev ? n0 : n1;
        if (next === component[0]) break;
        ring.push(next);
        prev = current;
        current = next;
      }
      const points = simplify(ring.map(positionOf), true, tolerance);
      if (points.length >= 3) {
        lines.push({
          points: [...points, copy(points[0])],
          closed: true,
          componentIndex,
        });
      }
    } else {
      const used = new Set();
      for (const from of breaks) {
        for (const first of adjacency.get(from)) {
          if (used.has(edgeId(from, first))) continue;
          used.add(edgeId(from, first));
          const chain = [from, first];
          let prev = from;
          let current = first;
          while (adjacency.get(current).length === 2) {
            const [n0, n1] = adjacency.get(current);
            const next = n0 !== prev ? n0 : n1;
            if (used.has(edgeId(current, next))) break;
            used.add(edgeId(current, next));
            chain.push(next);
            prev = current;
            current = next;
          }
          const points = simplify(chain.map(positionOf), false, tolerance);
          if (points.length >= 2) {
            lines.push({ points, closed: false, componentIndex });
          }
        }
      }
    }
    componentIndex += 1;
  }

  return lines;
}
