// Re-entrant (concave, inside-corner) edges of ONE host, from its sharp
// chains (buildHostPartIndex) and its ORIENTED islands (orientHostByRole:
// normals toward the painted side, the one the viewer stands on).
//
// For a chain bordered by exactly two islands F1, F2: with m its midpoint
// and p_k a point of F_k a step inside the face from the edge, the edge is
// re-entrant when each face lies on the FRONT side of the other —
//   dot(n1, p2 − m) > 0  &&  dot(n2, p1 − m) > 0
// (the dihedral seen from the painted side is below 180°). On the pool
// shell with normals toward the water: floor–wall junctions, the slope →
// deep floor change and the long-wall caps are re-entrant; the flat → slope
// change (shallow end) is not.
//
// Pure (no three.js), node-testable.

import {
  add,
  cross,
  dot,
  length,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import { DEFAULT_QTES_THRESHOLDS } from "./classifyHostPartsByRules.js";
import { computeFaceBasis, projectPoint } from "./meshPaintGeometry.js";

// Plane / loop distance under which a chain borders an island (same rule as
// buildHostPartIndex.attachChainSides).
const CHAIN_SIDE_TOL_M = 1e-3;
// Step inside each face when probing the dihedral.
const PROBE_STEP_M = 0.02;

const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function distanceToSegment2d(p, a, b) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return dist2d(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2)
  );
  return dist2d(p, [a[0] + abx * t, a[1] + aby * t]);
}

function isNearLoops(p, loops, tol) {
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      if (distanceToSegment2d(p, loop[i], loop[(i + 1) % loop.length]) <= tol) {
        return true;
      }
    }
  }
  return false;
}

// Islands of a host that a chain borders (indices into host.islands).
export function findChainIslands(chain, islands, tol = CHAIN_SIDE_TOL_M) {
  const [a, b] = chain.points;
  const samples = [0.25, 0.5, 0.75].map((t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }));
  const found = [];
  islands.forEach((island, index) => {
    const points = (island.polygons || []).flatMap((polygon) => [
      ...(polygon.contour || []),
      ...(polygon.holes || []).flat(),
    ]);
    if (!points.length) return;
    const d = dot(island.normal, island.centroid);
    if (Math.abs(dot(island.normal, a) - d) > tol) return;
    if (Math.abs(dot(island.normal, b) - d) > tol) return;
    const basis = computeFaceBasis(island.normal, points[0]);
    const loops = (island.polygons || []).flatMap((polygon) =>
      [polygon.contour, ...(polygon.holes || [])].map((loop) =>
        loop.map((p) => projectPoint(p, basis))
      )
    );
    const borders = samples.some((p) =>
      isNearLoops(projectPoint(p, basis), loops, tol)
    );
    if (borders) found.push(index);
  });
  return found;
}

// One representative per distinct plane among the bordering islands.
const COPLANAR_COS = 0.9999;
function groupCoplanar(indices, islands) {
  const out = [];
  for (const index of indices) {
    const island = islands[index];
    const n = normalize(island.normal);
    const d = dot(n, island.centroid);
    const same = out.some((other) => {
      const o = islands[other];
      const on = normalize(o.normal);
      return (
        dot(n, on) > COPLANAR_COS &&
        Math.abs(dot(on, o.centroid) - d) <= CHAIN_SIDE_TOL_M
      );
    });
    if (!same) out.push(index);
  }
  return out;
}

// 2D point-in-polygon (even-odd) on a projected loop.
function pointInLoop2d(p, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i];
    const [xj, yj] = loop[j];
    const crosses =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || 1e-300) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInIsland(point, island) {
  const points = (island.polygons || []).flatMap((polygon) => polygon.contour);
  const basis = computeFaceBasis(island.normal, points[0]);
  const q = projectPoint(point, basis);
  return (island.polygons || []).some((polygon) => {
    if (
      !pointInLoop2d(
        q,
        polygon.contour.map((p) => projectPoint(p, basis))
      )
    ) {
      return false;
    }
    return !(polygon.holes || []).some((hole) =>
      pointInLoop2d(
        q,
        hole.map((p) => projectPoint(p, basis))
      )
    );
  });
}

// Point of `island` a step inside the face from the chain midpoint: along
// the in-plane perpendicular of the edge, on the side that lies INSIDE the
// face (a concave face's centroid may sit on the wrong side of the edge).
function probePoint(island, m, edgeDir) {
  const perp = normalize(cross(island.normal, edgeDir));
  if (length(perp) > 0) {
    const forward = add(m, scale(perp, PROBE_STEP_M));
    if (pointInIsland(forward, island)) return forward;
    const backward = add(m, scale(perp, -PROBE_STEP_M));
    if (pointInIsland(backward, island)) return backward;
  }
  // fallback: toward the centroid
  const toCentroid = sub(island.centroid, m);
  const inPlane = sub(toCentroid, scale(edgeDir, dot(toCentroid, edgeDir)));
  return length(inPlane) > 1e-9
    ? add(m, scale(normalize(inPlane), PROBE_STEP_M))
    : add(m, scale(perp, PROBE_STEP_M));
}

/**
 * @param {object} args
 * @param {{hostId, islands, chains}} args.host oriented host
 * @param {object} [args.thresholds]
 * @returns {Array<{hostId, points:[a,b], sides:[n1,n2], length}>}
 */
export default function findReentrantChains({
  host,
  thresholds = DEFAULT_QTES_THRESHOLDS,
}) {
  void thresholds;
  const out = [];
  const islands = host.islands || [];
  for (const chain of host.chains || []) {
    const [a, b] = chain.points;
    const edge = sub(b, a);
    const len = length(edge);
    if (!(len > 1e-9)) continue;
    // coplanar islands (a wall split by a break point) count as one face
    const planes = groupCoplanar(findChainIslands(chain, islands), islands);
    if (planes.length !== 2) continue;
    const f1 = islands[planes[0]];
    const f2 = islands[planes[1]];
    const n1 = normalize(f1.normal);
    const n2 = normalize(f2.normal);
    const m = scale(add(a, b), 0.5);
    const edgeDir = scale(edge, 1 / len);
    const p1 = probePoint(f1, m, edgeDir);
    const p2 = probePoint(f2, m, edgeDir);
    if (dot(n1, sub(p2, m)) > 0 && dot(n2, sub(p1, m)) > 0) {
      out.push({
        hostId: host.hostId,
        points: [{ ...a }, { ...b }],
        sides: [n1, n2],
        length: len,
      });
    }
  }
  return out;
}
