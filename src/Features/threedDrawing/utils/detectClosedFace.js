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

// Enumeration guards. Candidate closures may legitimately be longer than the
// shortest one (a wall rectangle behind a shorter cap triangle), so the DFS
// explores up to shortest + MAX_EXTRA_EDGES — bounded, since junk closures
// (e.g. the complementary region of a split face) are discarded later by the
// shortest-per-plane rule.
const MAX_CANDIDATE_PATHS = 64;
const MAX_EXTRA_EDGES = 2;
const MAX_CYCLE_EDGES = 10;

// All simple paths startKey → endKey with at most (shortest + MAX_EXTRA_EDGES)
// edges, excluding the just-drawn segment and the direct startKey → endKey
// step. Pruned by a reverse-BFS distance-to-end bound.
function enumerateClosingPaths(adj, startKey, endKey, forbiddenEdgeIdx) {
  if (startKey === endKey) return [];

  const distEnd = new Map([[endKey, 0]]);
  const queue = [endKey];
  while (queue.length) {
    const cur = queue.shift();
    const d = distEnd.get(cur);
    for (const { neighborKey } of adj.get(cur) || []) {
      if (!distEnd.has(neighborKey)) {
        distEnd.set(neighborKey, d + 1);
        queue.push(neighborKey);
      }
    }
  }
  const shortest = distEnd.get(startKey);
  if (shortest == null) return [];
  const maxLen = Math.min(
    Math.max(shortest, 2) + MAX_EXTRA_EDGES,
    MAX_CYCLE_EDGES
  );

  const paths = [];
  const visited = new Set([startKey]);
  function dfs(cur, pathNodes, edgeIdxs) {
    if (paths.length >= MAX_CANDIDATE_PATHS) return;
    for (const { neighborKey, edgeIdx } of adj.get(cur) || []) {
      if (edgeIdx === forbiddenEdgeIdx && edgeIdx !== MESH_EDGE_IDX) continue;
      // Forbid the direct startKey → endKey step regardless of which edge
      // it would take. The just-added user segment IS this direct edge; if
      // a *parallel* mesh edge exists between the same pair, taking it
      // would yield a degenerate 2-edge cycle. We want cycles of length ≥
      // 3 (i.e., path length ≥ 2).
      if (cur === startKey && neighborKey === endKey) continue;
      if (neighborKey === endKey) {
        if (edgeIdxs.length + 1 >= 2) {
          paths.push({
            pathNodes: [...pathNodes, endKey],
            edgeIdxs: [...edgeIdxs, edgeIdx],
          });
        }
        continue;
      }
      if (visited.has(neighborKey)) continue;
      const bound = edgeIdxs.length + 1 + (distEnd.get(neighborKey) ?? Infinity);
      if (bound > maxLen) continue;
      visited.add(neighborKey);
      dfs(neighborKey, [...pathNodes, neighborKey], [...edgeIdxs, edgeIdx]);
      visited.delete(neighborKey);
    }
  }
  dfs(startKey, [startKey], []);
  return paths;
}

// Canonical key of the plane holding a coplanar cycle (Newell normal with a
// canonical sign + quantized offset). Used to group candidate closures: two
// closures in the SAME plane are alternatives splitting that plane (keep the
// shortest ones), while closures in different planes are genuinely different
// faces (commit them all).
function planeKeyOf(points) {
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    nx += (p.y - q.y) * (p.z + q.z);
    ny += (p.z - q.z) * (p.x + q.x);
    nz += (p.x - q.x) * (p.y + q.y);
  }
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-12) return "degenerate";
  nx /= len;
  ny /= len;
  nz /= len;
  if (nx < -1e-6 || (nx <= 1e-6 && (ny < -1e-6 || (ny <= 1e-6 && nz < 0)))) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const d = nx * points[0].x + ny * points[0].y + nz * points[0].z;
  return `${Math.round(nx * 100)}_${Math.round(ny * 100)}_${Math.round(
    nz * 100
  )}_${Math.round(d * 200)}`;
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

// Detect the closed coplanar cycles that contain the segment at index
// `lastSegmentIdx` (the one just added by the user). Mesh edges (from
// existing geometry) act as silent borders — they connect picked vertices
// through actual mesh topology so the user doesn't have to redraw them.
//
// Multiple-closure rule: when the drawn segment closes several faces (e.g. a
// notch diagonal that closes both the floor triangle and the wall rectangle
// behind it), ALL of them are returned and committed — the user then deletes
// the face(s) they don't want. To avoid committing junk, closures lying in
// the SAME plane are alternatives splitting that plane: only the shortest
// ones there survive (ties kept — a wall diagonal commits both its upper and
// lower triangle), which drops e.g. the complementary contour of a split cap.
//
// Returns Array<{ cornersInOrder: Array<{x,y,z}>, consumedSegments:
// Array<{a,b}> }> (empty when nothing closes). consumedSegments only
// includes user-drawn segments — mesh edges are not consumed.
export default function detectClosedFace(allSegments, lastSegmentIdx) {
  if (!Array.isArray(allSegments) || allSegments.length === 0) return [];
  if (lastSegmentIdx < 0 || lastSegmentIdx >= allSegments.length) return [];

  const meshAdj = getMeshAdjacency();
  const { nodes, adj } = buildGraph(allSegments, meshAdj);
  const lastSeg = allSegments[lastSegmentIdx];
  const startKey = quantizeVertex(lastSeg.a);
  const endKey = quantizeVertex(lastSeg.b);
  if (startKey === endKey) return [];
  if (!adj.has(startKey) || !adj.has(endKey)) return [];

  const paths = enumerateClosingPaths(adj, startKey, endKey, lastSegmentIdx);

  const candidates = [];
  for (const path of paths) {
    if (path.pathNodes.length < 3) continue;
    const cornerPoints = path.pathNodes.map((k) => nodes.get(k));
    if (!isCoplanar(cornerPoints)) continue;
    candidates.push({
      path,
      cornerPoints,
      planeKey: planeKeyOf(cornerPoints),
      len: path.edgeIdxs.length,
    });
  }
  if (candidates.length === 0) return [];

  const bestByPlane = new Map(); // planeKey -> Array<candidate> (shortest, ties kept)
  for (const c of candidates) {
    const group = bestByPlane.get(c.planeKey);
    if (!group || c.len < group[0].len) bestByPlane.set(c.planeKey, [c]);
    else if (c.len === group[0].len) group.push(c);
  }

  const faces = [];
  for (const group of bestByPlane.values()) {
    for (const { path, cornerPoints } of group) {
      faces.push({
        cornersInOrder: cornerPoints.map((v) => ({ x: v.x, y: v.y, z: v.z })),
        consumedSegments: [
          lastSeg,
          ...path.edgeIdxs
            .filter((i) => i !== MESH_EDGE_IDX)
            .map((i) => allSegments[i]),
        ],
      });
    }
  }
  return faces;
}
