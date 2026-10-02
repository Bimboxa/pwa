import { EDGE_COLLINEAR_DEG } from "../constants/meshPaintConstants.js";

// Maximal straight edge through a picked feature-edge piece: tessellation
// (CSG T-junctions, sampled sub-segments, thin-wall quads) cuts a visually
// straight edge into pieces; the brush paints the whole straight edge.
//
// adjacency: the feature-edge graph of useVertexSnap.buildIndex —
//   Map<key, {position: Vector3|{x,y,z}, neighbors: Set<key>|key[]}> (a
//   plain object keyed the same way works too); keys are quantizeVertex keys.
// keyA, keyB: the picked piece's end keys (quantizeVertex of the snapped
//   edge ends).
// cosTol: a neighbor continues the edge when the direction toward it is
//   within acos(cosTol) of the PICKED piece's direction (fixed reference: a
//   finely sampled arc never drifts into one long "straight" edge).
//
// Each end walks independently through the vertices that have a straight
// continuation, whatever other feature edges branch off them (a tessellation
// T-junction, a jamb meeting the base of a wall): a vertex without a straight
// continuation is a corner and ends the edge. Among several straight
// continuations (overlapping pieces), the farthest one is taken.
//
// Returns {a: {x,y,z}, b: {x,y,z}} (a on keyA's side), or null when a key is
// unknown / the piece is degenerate. Pure: node-testable.

const DEFAULT_COS = Math.cos((EDGE_COLLINEAR_DEG * Math.PI) / 180);
const MAX_STEPS = 10000;

const getNode = (adjacency, key) => {
  if (!adjacency || key === undefined || key === null) return undefined;
  return typeof adjacency.get === "function"
    ? adjacency.get(key)
    : adjacency[key];
};

const toV = (p) => ({ x: p.x, y: p.y, z: p.z });

function walk(adjacency, fromKey, startKey, dir, cosTol) {
  const visited = new Set([fromKey, startKey]);
  let currentKey = startKey;
  let current = getNode(adjacency, startKey);
  for (let step = 0; step < MAX_STEPS && current; step++) {
    const origin = current.position;
    let bestKey = null;
    let bestNode = null;
    let bestDist = 0;
    for (const neighborKey of current.neighbors || []) {
      if (visited.has(neighborKey)) continue;
      const neighbor = getNode(adjacency, neighborKey);
      if (!neighbor?.position) continue;
      const dx = neighbor.position.x - origin.x;
      const dy = neighbor.position.y - origin.y;
      const dz = neighbor.position.z - origin.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist === 0) continue;
      const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / dist;
      if (cos < cosTol) continue;
      if (dist > bestDist) {
        bestDist = dist;
        bestKey = neighborKey;
        bestNode = neighbor;
      }
    }
    if (!bestNode) break;
    visited.add(bestKey);
    currentKey = bestKey;
    current = bestNode;
  }
  return getNode(adjacency, currentKey)?.position ?? null;
}

export default function extendCollinearEdge(
  adjacency,
  keyA,
  keyB,
  cosTol = DEFAULT_COS
) {
  const nodeA = getNode(adjacency, keyA);
  const nodeB = getNode(adjacency, keyB);
  if (!nodeA?.position || !nodeB?.position || keyA === keyB) return null;
  const pa = nodeA.position;
  const pb = nodeB.position;
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const dz = pb.z - pa.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(len > 0)) return null;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  const back = { x: -dir.x, y: -dir.y, z: -dir.z };
  const b = walk(adjacency, keyA, keyB, dir, cosTol) ?? pb;
  const a = walk(adjacency, keyB, keyA, back, cosTol) ?? pa;
  return { a: toV(a), b: toV(b) };
}
