/**
 * findPolygonCandidates
 *
 * Treats every input segment as an INDEPENDENT edge — segments may come from
 * different annotations and need not share point ids. Builds the planar
 * arrangement of all segments (splitting each one at every mutual intersection
 * so that each crossing / T-junction becomes a graph node), then extracts every
 * minimal closed loop (bounded face) of that graph.
 *
 * The caller picks the smallest loop containing the mouse — that is the polygon
 * "around the cursor" formed by some subset of the surrounding segments.
 *
 * @param {Array<{a:{x:number,y:number}, b:{x:number,y:number}}>} segments
 * @param {number} [tolerance=5] - Merge / intersection tolerance in pixels
 * @returns {Array<Array<{x:number, y:number}>>} - Closed rings (last point === first point)
 */
export default function findPolygonCandidates(segments, tolerance = 5) {
  if (!segments || segments.length === 0) return [];

  // 1. Split every segment at its intersections with all the others.
  const split = splitSegmentsAtIntersections(segments, tolerance);
  if (split.length === 0) return [];

  // 2. Build the planar graph (endpoints merged by proximity).
  const graph = buildGraph(split, tolerance);
  if (graph.nodes.length === 0) return [];

  // 3. Drop dangling edges (degree <= 1) — they can't bound a loop.
  pruneLeaves(graph);

  // 4. Walk every minimal face.
  return extractFaces(graph);
}

// ---------------------------------------------------------------------------
// Step 1: planar split
// ---------------------------------------------------------------------------

function splitSegmentsAtIntersections(segments, tolerance) {
  // Normalize input + drop degenerate (zero-length) segments.
  const segs = [];
  for (const s of segments) {
    if (!s || !s.a || !s.b) continue;
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    if (dx * dx + dy * dy < 1e-9) continue;
    segs.push({
      a: { x: s.a.x, y: s.a.y },
      b: { x: s.b.x, y: s.b.y },
      len: Math.sqrt(dx * dx + dy * dy),
    });
  }

  const n = segs.length;
  const splitTs = segs.map(() => []); // interior split params per segment

  for (let i = 0; i < n; i++) {
    const s1 = segs[i];
    const eps1 = tolerance / s1.len;
    for (let j = i + 1; j < n; j++) {
      const s2 = segs[j];
      const hit = segmentIntersection(s1.a, s1.b, s2.a, s2.b);
      if (!hit) continue;
      const eps2 = tolerance / s2.len;
      if (hit.t1 > eps1 && hit.t1 < 1 - eps1) splitTs[i].push(hit.t1);
      if (hit.t2 > eps2 && hit.t2 < 1 - eps2) splitTs[j].push(hit.t2);
    }
  }

  const out = [];
  for (let i = 0; i < n; i++) {
    const { a, b, len } = segs[i];
    const epsT = tolerance / len;
    const ts = splitTs[i];
    ts.push(0, 1);
    ts.sort((x, y) => x - y);

    // Deduplicate params that are closer than the tolerance.
    const uniq = [];
    for (const t of ts) {
      if (uniq.length === 0 || t - uniq[uniq.length - 1] > epsT) uniq.push(t);
    }
    if (uniq[uniq.length - 1] < 1) uniq[uniq.length - 1] = 1;

    for (let k = 0; k < uniq.length - 1; k++) {
      const ta = uniq[k];
      const tb = uniq[k + 1];
      out.push({
        a: { x: a.x + (b.x - a.x) * ta, y: a.y + (b.y - a.y) * ta },
        b: { x: a.x + (b.x - a.x) * tb, y: a.y + (b.y - a.y) * tb },
      });
    }
  }

  return out;
}

/**
 * Proper intersection of segments p1-p2 and p3-p4.
 * Returns { t1, t2 } parameters (0..1) of the intersection on each segment,
 * or null if they don't cross (parallel / collinear are treated as no-cross —
 * shared endpoints are handled later by node merging). A small epsilon lets
 * endpoints touching mid-segment register as T-junctions.
 */
function segmentIntersection(p1, p2, p3, p4) {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = p4.x - p3.x;
  const sy = p4.y - p3.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;

  const qpx = p3.x - p1.x;
  const qpy = p3.y - p1.y;
  const t1 = (qpx * sy - qpy * sx) / denom;
  const t2 = (qpx * ry - qpy * rx) / denom;

  const E = 1e-6;
  if (t1 < -E || t1 > 1 + E || t2 < -E || t2 > 1 + E) return null;
  return { t1, t2 };
}

// ---------------------------------------------------------------------------
// Step 2: planar graph
// ---------------------------------------------------------------------------

function buildGraph(segments, tolerance) {
  const nodes = []; // {x, y}
  const adj = []; // adj[i] = Set<number>
  const tolSq = tolerance * tolerance;
  const cell = Math.max(tolerance, 1);
  const grid = new Map(); // "cx,cy" -> number[] of node indices

  function getNode(p) {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = grid.get(gx + "," + gy);
        if (!bucket) continue;
        for (const ni of bucket) {
          const dx = nodes[ni].x - p.x;
          const dy = nodes[ni].y - p.y;
          if (dx * dx + dy * dy <= tolSq) return ni;
        }
      }
    }
    const idx = nodes.length;
    nodes.push({ x: p.x, y: p.y });
    adj.push(new Set());
    const key = cx + "," + cy;
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(idx);
    return idx;
  }

  for (const s of segments) {
    const a = getNode(s.a);
    const b = getNode(s.b);
    if (a !== b) {
      adj[a].add(b);
      adj[b].add(a);
    }
  }

  return { nodes, adj };
}

// ---------------------------------------------------------------------------
// Step 3: prune dangling edges
// ---------------------------------------------------------------------------

function pruneLeaves(graph) {
  const { nodes, adj } = graph;
  const queue = [];
  for (let i = 0; i < nodes.length; i++) {
    if (adj[i].size <= 1) queue.push(i);
  }
  while (queue.length > 0) {
    const i = queue.pop();
    if (adj[i].size === 0) continue;
    for (const nb of adj[i]) {
      adj[nb].delete(i);
      if (adj[nb].size <= 1) queue.push(nb);
    }
    adj[i].clear();
  }
}

// ---------------------------------------------------------------------------
// Step 4: minimal face extraction (half-edge traversal)
// ---------------------------------------------------------------------------

function extractFaces(graph) {
  const { nodes, adj } = graph;

  // Neighbors of each node sorted by polar angle (ascending = CCW).
  const sorted = nodes.map((_, i) =>
    [...adj[i]]
      .map((j) => ({
        j,
        ang: Math.atan2(nodes[j].y - nodes[i].y, nodes[j].x - nodes[i].x),
      }))
      .sort((p, q) => p.ang - q.ang)
  );
  const indexOfNbr = nodes.map((_, i) => {
    const m = new Map();
    sorted[i].forEach((e, k) => m.set(e.j, k));
    return m;
  });

  // Arriving at v from u, the next face edge is the neighbor of v that is the
  // next one CLOCKWISE from u (one step before u in the CCW-sorted list).
  function nextVertex(u, v) {
    const list = sorted[v];
    if (list.length === 0) return -1;
    const ui = indexOfNbr[v].get(u);
    if (ui === undefined) return -1;
    const k = (ui - 1 + list.length) % list.length;
    return list[k].j;
  }

  const visited = new Set(); // "u,v" directed half-edges
  const seenKeys = new Set(); // dedupe reversed orientation of isolated cycles
  const faces = [];

  let halfEdgeCount = 0;
  for (let i = 0; i < nodes.length; i++) halfEdgeCount += adj[i].size;
  const maxSteps = halfEdgeCount + 1;

  for (let u = 0; u < nodes.length; u++) {
    for (const start of sorted[u]) {
      const v0 = start.j;
      if (visited.has(u + "," + v0)) continue;

      const cycle = [];
      let pu = u;
      let pv = v0;
      let steps = 0;
      let ok = true;
      while (true) {
        const k = pu + "," + pv;
        if (visited.has(k)) break;
        visited.add(k);
        cycle.push(pu);
        const w = nextVertex(pu, pv);
        if (w < 0) {
          ok = false;
          break;
        }
        pu = pv;
        pv = w;
        if (pu === u && pv === v0) break;
        if (++steps > maxSteps) {
          ok = false;
          break;
        }
      }

      if (!ok || cycle.length < 3) continue;

      const key = normalizeCycleKey(cycle);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const ring = cycle.map((idx) => ({ x: nodes[idx].x, y: nodes[idx].y }));
      ring.push({ x: ring[0].x, y: ring[0].y }); // close
      faces.push(ring);
    }
  }

  return faces;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a cycle of node indices for dedup: rotate to the smallest index,
 * then pick the lexicographically smaller of the two directions. Collapses the
 * two opposite orientations of an isolated cycle into one key.
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
