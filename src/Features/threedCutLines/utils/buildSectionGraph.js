import quantizeVertex from "../../threedDrawing/utils/quantizeVertex.js";
import {
  add,
  copy,
  distance,
  dot,
  length,
  lengthSq,
  normalize,
  scale,
  sub,
} from "./vec3.js";

// An edge is "parallel" to a direction under 5 degrees.
const COS_PARALLEL = Math.cos((5 * Math.PI) / 180);

function getOrCreateNode(nodes, position) {
  const key = quantizeVertex(position);
  if (!nodes.has(key)) {
    nodes.set(key, { position: copy(position), neighbors: [] });
  }
  return key;
}

function link(nodes, ka, kb, normal) {
  nodes.get(ka).neighbors.push({ key: kb, normal });
  nodes.get(kb).neighbors.push({ key: ka, normal });
}

// Undirected graph of the section segments, keyed by 1 mm quantized position
// (same scheme as the snap index, see quantizeVertex).
//
//   segments = [{ a, b, normal }]   (sectionTrianglesByPlane output)
//
// Returns { nodes: Map<key, { position, neighbors: [{ key, normal }] }> }.
//
// T-junctions: any node lying within `tolerance` of a segment, strictly
// between its endpoints, splits that segment in two — the base of a wall
// standing on a slab becomes a node of the slab's section segment, so the
// walk can turn from the slab onto the wall.
//
// Overlapping collinear segments (slab top vs wall bottom) are kept as
// doubled edges: a node then lists the same neighbor key twice, each entry
// carrying the normal of its own triangle.
export default function buildSectionGraph(segments, { tolerance = 1e-3 } = {}) {
  const nodes = new Map();
  const edges = [];

  for (const seg of segments ?? []) {
    if (!seg?.a || !seg?.b) continue;
    const ka = getOrCreateNode(nodes, seg.a);
    const kb = getOrCreateNode(nodes, seg.b);
    if (ka === kb) continue;
    edges.push({ ka, kb, normal: seg.normal ?? null });
  }

  const entries = [...nodes.entries()];
  for (const { ka, kb, normal } of edges) {
    const a = nodes.get(ka).position;
    const b = nodes.get(kb).position;
    const ab = sub(b, a);
    const len2 = lengthSq(ab);
    if (len2 < 1e-18) continue;

    // Nodes sitting on the open segment (a, b).
    const inner = [];
    for (const [key, node] of entries) {
      if (key === ka || key === kb) continue;
      const p = node.position;
      const t = dot(sub(p, a), ab) / len2;
      if (t <= 0 || t >= 1) continue;
      if (distance(add(a, scale(ab, t)), p) > tolerance) continue;
      if (distance(p, a) <= tolerance || distance(p, b) <= tolerance) continue;
      inner.push({ key, t });
    }
    inner.sort((p, q) => p.t - q.t);

    let prev = ka;
    for (const { key } of inner) {
      link(nodes, prev, key, normal);
      prev = key;
    }
    link(nodes, prev, kb, normal);
  }

  return { nodes };
}

// Find the graph edge closest to `point` whose direction is parallel to
// ±`direction` (under 5°), and insert `point` (projected onto that edge) as a
// node splitting it. Doubled edges are split together, each half keeping its
// normal. Returns the key of the inserted node — or of an existing endpoint
// when the point already sits on one — or null when no parallel edge lies
// within `tolerance * 10`.
export function locateOnGraph(graph, point, direction, tolerance = 1e-3) {
  const nodes = graph?.nodes;
  const dir = normalize(direction);
  if (!nodes || !point || !dir) return null;
  const maxDist = tolerance * 10;

  let best = null;
  const seen = new Set();
  for (const [ka, node] of nodes) {
    for (const { key: kb } of node.neighbors) {
      const edgeId = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(edgeId)) continue;
      seen.add(edgeId);
      const other = nodes.get(kb);
      if (!other) continue;
      const a = node.position;
      const ab = sub(other.position, a);
      const len = length(ab);
      if (len < 1e-12) continue;
      const u = scale(ab, 1 / len);
      if (Math.abs(dot(u, dir)) < COS_PARALLEL) continue;
      const t = Math.min(1, Math.max(0, dot(sub(point, a), u) / len));
      const proj = add(a, scale(ab, t));
      const dist = distance(proj, point);
      if (dist > maxDist) continue;
      if (!best || dist < best.dist) best = { ka, kb, proj, dist };
    }
  }
  if (!best) return null;

  const { ka, kb, proj } = best;
  const nodeA = nodes.get(ka);
  const nodeB = nodes.get(kb);
  if (distance(proj, nodeA.position) <= tolerance) return ka;
  if (distance(proj, nodeB.position) <= tolerance) return kb;
  const key = getOrCreateNode(nodes, proj);
  if (key === ka || key === kb) return key;

  const normals = [];
  nodeA.neighbors = nodeA.neighbors.filter((n) => {
    if (n.key !== kb) return true;
    normals.push(n.normal);
    return false;
  });
  nodeB.neighbors = nodeB.neighbors.filter((n) => n.key !== ka);
  for (const normal of normals) {
    link(nodes, ka, key, normal);
    link(nodes, key, kb, normal);
  }
  return key;
}
