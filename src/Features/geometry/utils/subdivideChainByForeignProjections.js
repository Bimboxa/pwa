// skip projected points closer than 1px to an existing vertex
const SUBDIV_DEDUP_PX = 1;

/**
 * Project point P onto segment [A, B]. Returns { dist, t, projPt } or null
 * when the projection falls outside the segment.
 */
function projectOntoSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return null;

  const t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  if (t < 0 || t > 1) return null;

  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return {
    dist: Math.hypot(px - projX, py - projY),
    t,
    projPt: { x: projX, y: projY },
  };
}

/**
 * Collect unique foreign vertices from the foreign edge set,
 * preserving their original IDs when available.
 */
function collectForeignVertices(foreignEdges) {
  const seen = new Set();
  const vertices = [];
  for (const e of foreignEdges) {
    const kA = `${e.ax},${e.ay}`;
    if (!seen.has(kA)) {
      seen.add(kA);
      vertices.push({ x: e.ax, y: e.ay, id: e.idA });
    }
    const kB = `${e.bx},${e.by}`;
    if (!seen.has(kB)) {
      seen.add(kB);
      vertices.push({ x: e.bx, y: e.by, id: e.idB });
    }
  }
  return vertices;
}

/**
 * Subdivide an open chain by projecting foreign vertices onto its segments.
 * For each foreign vertex within detectionPx, its projection point is
 * inserted into the chain, splitting long segments into sub-segments
 * that can then be properly classified by proximity.
 * Open-chain variant of subdivideRingByForeignProjections (no wraparound
 * edge between last and first points).
 */
export default function subdivideChainByForeignProjections(
  chain,
  foreignEdges,
  detectionPx
) {
  if (chain.length < 2 || foreignEdges.length === 0) return chain;

  const foreignVertices = collectForeignVertices(foreignEdges);
  const result = [chain[0]];

  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];

    const projections = [];
    for (const fv of foreignVertices) {
      const proj = projectOntoSegment(fv.x, fv.y, a.x, a.y, b.x, b.y);
      if (!proj || proj.dist > detectionPx) continue;
      // Skip projections too close to segment endpoints (distance-based)
      if (
        Math.hypot(proj.projPt.x - a.x, proj.projPt.y - a.y) < SUBDIV_DEDUP_PX
      )
        continue;
      if (
        Math.hypot(proj.projPt.x - b.x, proj.projPt.y - b.y) < SUBDIV_DEDUP_PX
      )
        continue;
      projections.push(proj);
    }

    projections.sort((a, b) => a.t - b.t);

    // Deduplicate close projections (both by t and by distance)
    let lastPt = a;
    for (let j = 0; j < projections.length; j++) {
      const pp = projections[j].projPt;
      if (Math.hypot(pp.x - lastPt.x, pp.y - lastPt.y) < SUBDIV_DEDUP_PX)
        continue;
      const newPt = { x: pp.x, y: pp.y };
      result.push(newPt);
      lastPt = newPt;
    }

    result.push(b);
  }

  return result;
}
