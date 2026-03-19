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

  // Step 1: Build graph
  const graph = buildGraph(paths, tolerance);
  if (graph.nodes.length === 0) return [];

  // Step 2: Find all cycles via DFS
  return findAllCycles(graph);
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
