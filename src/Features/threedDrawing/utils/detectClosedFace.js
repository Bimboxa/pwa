import { getMeshAdjacency } from "../services/meshGraphStore";
import quantizeVertex from "./quantizeVertex";

const COPLANAR_EPS_M = 2e-3; // 2 mm max deviation from best-fit plane
const MESH_EDGE_IDX = -1; // sentinel for edges that come from existing mesh
// geometry rather than from a user-drawn segment

// Build an undirected graph from the user/trait segment list. Then augment
// it with mesh-derived edges from the global adjacency (built by
// useVertexSnap when drawing mode activates), so existing mesh geometry can
// stand in as candidate face borders without the user redrawing them.
function buildGraph(segments, meshAdj) {
  const nodes = new Map(); // key -> {x, y, z}
  const adj = new Map(); // key -> Array<{ neighborKey, edgeIdx }>

  function ensureNode(p) {
    const k = quantizeVertex(p);
    if (!nodes.has(k)) nodes.set(k, { x: p.x, y: p.y, z: p.z });
    if (!adj.has(k)) adj.set(k, []);
    return k;
  }

  segments.forEach((seg, idx) => {
    const ka = ensureNode(seg.a);
    const kb = ensureNode(seg.b);
    if (ka === kb) return;
    adj.get(ka).push({ neighborKey: kb, edgeIdx: idx });
    adj.get(kb).push({ neighborKey: ka, edgeIdx: idx });
  });

  if (meshAdj && meshAdj.size > 0) {
    for (const [key, info] of meshAdj.entries()) {
      if (!nodes.has(key)) {
        nodes.set(key, {
          x: info.position.x,
          y: info.position.y,
          z: info.position.z,
        });
        adj.set(key, []);
      }
    }
    for (const [key, info] of meshAdj.entries()) {
      const list = adj.get(key);
      for (const neighbor of info.neighbors) {
        if (!nodes.has(neighbor)) continue;
        list.push({ neighborKey: neighbor, edgeIdx: MESH_EDGE_IDX });
      }
    }
  }

  return { nodes, adj };
}

function bfsShortestPath(adj, startKey, endKey, forbiddenEdgeIdx) {
  if (startKey === endKey) return null;
  const prev = new Map();
  prev.set(startKey, null);
  const queue = [startKey];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === endKey) break;
    const neighbors = adj.get(cur) || [];
    for (const { neighborKey, edgeIdx } of neighbors) {
      if (edgeIdx === forbiddenEdgeIdx && edgeIdx !== MESH_EDGE_IDX) continue;
      // Forbid the direct startKey → endKey step regardless of which edge
      // it would take. The just-added user segment IS this direct edge; if
      // a *parallel* mesh edge exists between the same pair, taking it
      // would yield a degenerate 2-edge cycle. We want cycles of length ≥
      // 3 (i.e., BFS path length ≥ 2).
      if (cur === startKey && neighborKey === endKey) continue;
      if (prev.has(neighborKey)) continue;
      prev.set(neighborKey, { from: cur, edgeIdx });
      queue.push(neighborKey);
    }
  }
  if (!prev.has(endKey)) return null;

  const pathNodes = [];
  const edgeIdxs = [];
  let cur = endKey;
  while (cur !== startKey) {
    const step = prev.get(cur);
    pathNodes.push(cur);
    edgeIdxs.push(step.edgeIdx);
    cur = step.from;
  }
  pathNodes.push(startKey);
  pathNodes.reverse();
  edgeIdxs.reverse();
  return { pathNodes, edgeIdxs };
}

function isCoplanar(points) {
  if (points.length < 4) return true;
  let a = points[0];
  let b = null;
  let c = null;
  function dist(p, q) {
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const dz = p.z - q.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  for (let i = 1; i < points.length; i++) {
    if (dist(a, points[i]) > 1e-6) {
      b = points[i];
      break;
    }
  }
  if (!b) return true;
  function sub(p, q) {
    return { x: p.x - q.x, y: p.y - q.y, z: p.z - q.z };
  }
  function cross(u, v) {
    return {
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x,
    };
  }
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p === b) continue;
    const ab = sub(b, a);
    const ap = sub(p, a);
    const c1 = cross(ab, ap);
    if (c1.x * c1.x + c1.y * c1.y + c1.z * c1.z > 1e-12) {
      c = p;
      break;
    }
  }
  if (!c) return true; // all collinear → degenerate (not a face)
  const u = sub(b, a);
  const v = sub(c, a);
  const n = cross(u, v);
  const nLen = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
  if (nLen < 1e-9) return true;
  const nx = n.x / nLen,
    ny = n.y / nLen,
    nz = n.z / nLen;
  for (const p of points) {
    const ap = sub(p, a);
    const d = Math.abs(ap.x * nx + ap.y * ny + ap.z * nz);
    if (d > COPLANAR_EPS_M) return false;
  }
  return true;
}

// Detect a closed coplanar cycle that contains the segment at index
// `lastSegmentIdx` (the one just added by the user) AND at least one OTHER
// user/trait segment. Mesh edges (from existing geometry) act as silent
// borders — they connect picked vertices through actual mesh topology so
// the user doesn't have to redraw them.
//
// Returns { cornersInOrder: Array<{x,y,z}>, consumedSegments: Array<{a,b}> }
// or null. consumedSegments only includes user-drawn segments — mesh edges
// are not consumed.
export default function detectClosedFace(allSegments, lastSegmentIdx) {
  if (!Array.isArray(allSegments) || allSegments.length === 0) return null;
  if (lastSegmentIdx < 0 || lastSegmentIdx >= allSegments.length) return null;

  const meshAdj = getMeshAdjacency();
  const { nodes, adj } = buildGraph(allSegments, meshAdj);
  const lastSeg = allSegments[lastSegmentIdx];
  const startKey = quantizeVertex(lastSeg.a);
  const endKey = quantizeVertex(lastSeg.b);
  if (startKey === endKey) return null;
  if (!adj.has(startKey) || !adj.has(endKey)) return null;

  const path = bfsShortestPath(adj, startKey, endKey, lastSegmentIdx);
  if (!path) return null;
  if (path.pathNodes.length < 3) return null;

  const cornerPoints = path.pathNodes.map((k) => nodes.get(k));
  if (!isCoplanar(cornerPoints)) return null;

  const consumedSegments = [
    lastSeg,
    ...path.edgeIdxs
      .filter((i) => i !== MESH_EDGE_IDX)
      .map((i) => allSegments[i]),
  ];

  return {
    cornersInOrder: cornerPoints.map((v) => ({ x: v.x, y: v.y, z: v.z })),
    consumedSegments,
  };
}
