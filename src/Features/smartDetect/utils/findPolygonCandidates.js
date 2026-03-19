/**
 * findPolygonCandidates
 *
 * Pure geometry algorithm. Takes an array of paths (ordered points) and returns
 * all closed polygon candidates that can be formed by following these paths.
 *
 * A path = an array of {x, y} points defining consecutive edges.
 * Points shared between paths (within tolerance) create junctions where the
 * traversal can switch from one path to another.
 *
 * Algorithm:
 * 1. Build a graph: nodes = unique points (merged by tolerance),
 *    edges = consecutive point pairs from each path
 * 2. DFS from each node: follow edges, track visited nodes in current path.
 *    When revisiting a node → extract the cycle as a candidate polygon.
 *
 * @param {Array<Array<{x: number, y: number}>>} paths - Array of polylines
 * @param {number} [tolerance=5] - Distance threshold for merging points
 * @returns {Array<Array<{x: number, y: number}>>} - Closed rings (last point = first point)
 */
export default function findPolygonCandidates(paths, tolerance = 5) {
  if (!paths || paths.length === 0) return [];

  // Step 0: Insert junction points where a path endpoint falls on another path's segment
  const enrichedPaths = insertJunctions(paths, tolerance);

  // Step 1: Build graph
  const graph = buildGraph(enrichedPaths, tolerance);
  if (graph.nodes.length === 0) return [];

  // Step 2: Find all cycles via DFS
  return findAllCycles(graph);
}

// ---------------------------------------------------------------------------
// Step 0: Insert junction points
// ---------------------------------------------------------------------------

/**
 * For each endpoint of each path, check if it falls on a segment of another path.
 * If so, insert that point into the other path, splitting the segment.
 * This creates proper graph junctions where polylines meet mid-segment.
 */
function insertJunctions(paths, tolerance) {
  // Collect all endpoints (first and last point of each path)
  const endpoints = [];
  for (let pi = 0; pi < paths.length; pi++) {
    const path = paths[pi];
    if (path.length < 2) continue;
    endpoints.push({ pt: path[0], pathIdx: pi });
    endpoints.push({ pt: path[path.length - 1], pathIdx: pi });
    // Also collect intermediate points that have _id (shared topology points)
    for (let k = 1; k < path.length - 1; k++) {
      if (path[k]._id) endpoints.push({ pt: path[k], pathIdx: pi });
    }
  }

  // For each endpoint, check against all segments of OTHER paths
  // Collect insertions: { pathIdx, segmentIdx, point }
  const insertions = []; // grouped by pathIdx

  for (const { pt, pathIdx: srcPathIdx } of endpoints) {
    for (let pi = 0; pi < paths.length; pi++) {
      if (pi === srcPathIdx) continue;
      const path = paths[pi];
      for (let si = 0; si < path.length - 1; si++) {
        const a = path[si], b = path[si + 1];
        if (isPointOnSegment(pt, a, b, tolerance)) {
          insertions.push({ pathIdx: pi, segmentIdx: si, point: { ...pt } });
        }
      }
    }
  }

  if (insertions.length === 0) return paths;

  // Group insertions by path, sort by segment index (descending to insert from end)
  const byPath = {};
  for (const ins of insertions) {
    if (!byPath[ins.pathIdx]) byPath[ins.pathIdx] = [];
    byPath[ins.pathIdx].push(ins);
  }

  // Clone paths and insert points
  const result = paths.map((p) => [...p]);
  for (const [pathIdx, insList] of Object.entries(byPath)) {
    // Sort by segmentIdx descending, then by distance from segment start descending
    // (inserting from the end avoids index shifting issues)
    const pi = Number(pathIdx);
    const path = result[pi];

    // Deduplicate: don't insert if a point already exists nearby
    const tolSq = tolerance * tolerance;
    const filtered = insList.filter((ins) => {
      // Check if this point already exists in the path near the insertion position
      const nearby = path.some((p) => {
        const dx = p.x - ins.point.x, dy = p.y - ins.point.y;
        return dx * dx + dy * dy <= tolSq;
      });
      return !nearby;
    });

    // Sort by segment index descending, then by parameter t descending
    filtered.sort((a, b) => {
      if (a.segmentIdx !== b.segmentIdx) return b.segmentIdx - a.segmentIdx;
      // Compute t parameter for ordering within same segment
      const segA = path[a.segmentIdx], segB = path[a.segmentIdx + 1];
      const dx = segB.x - segA.x, dy = segB.y - segA.y;
      const lenSq = dx * dx + dy * dy;
      const tA = lenSq > 0 ? ((a.point.x - segA.x) * dx + (a.point.y - segA.y) * dy) / lenSq : 0;
      const tB = lenSq > 0 ? ((b.point.x - segA.x) * dx + (b.point.y - segA.y) * dy) / lenSq : 0;
      return tB - tA;
    });

    for (const ins of filtered) {
      result[pi].splice(ins.segmentIdx + 1, 0, ins.point);
    }
  }

  return result;
}

/**
 * Check if point P falls on segment A-B within tolerance.
 * Returns true if the projection of P onto A-B is within the segment
 * and the distance from P to the projection is within tolerance.
 */
function isPointOnSegment(p, a, b, tolerance) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  // Must be strictly inside the segment (not at endpoints)
  if (t <= 0.01 || t >= 0.99) return false;

  const projX = a.x + t * dx, projY = a.y + t * dy;
  const distSq = (p.x - projX) ** 2 + (p.y - projY) ** 2;
  return distSq <= tolerance * tolerance;
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

function buildGraph(paths, tolerance) {
  const nodes = []; // {x, y}
  const adj = [];   // adj[i] = Set<number> (neighbor indices)
  const tolSq = tolerance * tolerance;
  const idToNodeIdx = new Map(); // point ID → node index (primary merge key)

  function getNodeIdx(p) {
    // 1. Merge by point ID first (shared topology points)
    if (p._id && idToNodeIdx.has(p._id)) {
      return idToNodeIdx.get(p._id);
    }

    // 2. Merge by coordinate proximity
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - p.x;
      const dy = nodes[i].y - p.y;
      if (dx * dx + dy * dy <= tolSq) {
        // Register this ID for the existing node
        if (p._id) idToNodeIdx.set(p._id, i);
        return i;
      }
    }

    // 3. Create new node
    const idx = nodes.length;
    nodes.push({ x: p.x, y: p.y });
    adj.push(new Set());
    if (p._id) idToNodeIdx.set(p._id, idx);
    return idx;
  }

  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = getNodeIdx(path[i]);
      const b = getNodeIdx(path[i + 1]);
      if (a !== b) {
        adj[a].add(b);
        adj[b].add(a);
      }
    }
  }

  return { nodes, adj };
}

// ---------------------------------------------------------------------------
// Cycle detection via DFS
// ---------------------------------------------------------------------------

function findAllCycles(graph) {
  const { nodes, adj } = graph;
  const MAX_DEPTH = 500;
  const MAX_CYCLES = 200;
  const cycles = [];
  const seenKeys = new Set();

  for (let startNode = 0; startNode < nodes.length; startNode++) {
    if (adj[startNode].size < 2) continue;

    const path = [startNode];
    const inPath = new Uint8Array(nodes.length);
    inPath[startNode] = 1;

    function dfs(current, prevNode, depth) {
      if (cycles.length >= MAX_CYCLES || depth >= MAX_DEPTH) return;

      for (const neighbor of adj[current]) {
        if (cycles.length >= MAX_CYCLES) return;
        if (neighbor === prevNode) continue;

        if (inPath[neighbor]) {
          // Cycle found: extract sub-path from neighbor's position to current
          const cycleStartIdx = path.indexOf(neighbor);
          if (cycleStartIdx < 0) continue;
          const cycleNodes = path.slice(cycleStartIdx);
          if (cycleNodes.length < 3) continue;

          const key = normalizeCycleKey(cycleNodes);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const ring = cycleNodes.map((idx) => ({
              x: nodes[idx].x,
              y: nodes[idx].y,
            }));
            ring.push({ x: ring[0].x, y: ring[0].y }); // close
            cycles.push(ring);
          }
          continue; // don't recurse past a cycle
        }

        path.push(neighbor);
        inPath[neighbor] = 1;
        dfs(neighbor, current, depth + 1);
        path.pop();
        inPath[neighbor] = 0;
      }
    }

    dfs(startNode, -1, 0);
    inPath[startNode] = 0;
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a cycle for deduplication: rotate to smallest node index,
 * pick the lexicographically smaller direction.
 */
function normalizeCycleKey(cycle) {
  const n = cycle.length;
  let minPos = 0;
  for (let i = 1; i < n; i++) {
    if (cycle[i] < cycle[minPos]) minPos = i;
  }

  const forward = [];
  const reverse = [];
  for (let i = 0; i < n; i++) {
    forward.push(cycle[(minPos + i) % n]);
    reverse.push(cycle[(minPos - i + n) % n]);
  }

  const fKey = forward.join(",");
  const rKey = reverse.join(",");
  return fKey < rKey ? fKey : rKey;
}
