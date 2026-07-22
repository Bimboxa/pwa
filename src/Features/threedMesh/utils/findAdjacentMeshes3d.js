import getMesh3dLoops from "./getMesh3dLoops.js";

// Mailles adjacent to a set of boundary loops (world coords): a maille is
// adjacent when one of its own boundary loops touches one of the given loops
// — i.e. a vertex of one lies on an edge of the other within tolerance.
// Overlapping collinear edges (the common case after a split) always put at
// least one vertex on the other segment, so this catches shared borders
// without a full segment/segment overlap test.
//
// Loops come from getMesh3dLoops, so planar and curved (shell) mailles are
// handled the same way.

const TOL_M = 1e-3;
const TOL_SQ = TOL_M * TOL_M;

function bboxOfLoops(loops) {
  const box = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
  for (const loop of loops) {
    for (const p of loop) {
      if (p.x < box.minX) box.minX = p.x;
      if (p.y < box.minY) box.minY = p.y;
      if (p.z < box.minZ) box.minZ = p.z;
      if (p.x > box.maxX) box.maxX = p.x;
      if (p.y > box.maxY) box.maxY = p.y;
      if (p.z > box.maxZ) box.maxZ = p.z;
    }
  }
  return box;
}

const bboxesTouch = (b1, b2) =>
  b1.minX <= b2.maxX + TOL_M &&
  b2.minX <= b1.maxX + TOL_M &&
  b1.minY <= b2.maxY + TOL_M &&
  b2.minY <= b1.maxY + TOL_M &&
  b1.minZ <= b2.maxZ + TOL_M &&
  b2.minZ <= b1.maxZ + TOL_M;

function distSqPointToSegment3d(p, a, b) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const ez = b.z - a.z;
  const lenSq = ex * ex + ey * ey + ez * ez;
  let t = 0;
  if (lenSq > 0) {
    t = ((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const dx = p.x - (a.x + t * ex);
  const dy = p.y - (a.y + t * ey);
  const dz = p.z - (a.z + t * ez);
  return dx * dx + dy * dy + dz * dz;
}

function vertexOnLoop(loopA, loopB) {
  const n = loopB.length;
  for (const p of loopA) {
    for (let i = 0; i < n; i++) {
      const a = loopB[i];
      const b = loopB[(i + 1) % n];
      if (distSqPointToSegment3d(p, a, b) <= TOL_SQ) return true;
    }
  }
  return false;
}

const loopsTouch = (loopA, loopB) =>
  vertexOnLoop(loopA, loopB) || vertexOnLoop(loopB, loopA);

function anyLoopsTouch(loopsA, loopsB) {
  for (const la of loopsA) {
    for (const lb of loopsB) {
      if (loopsTouch(la, lb)) return true;
    }
  }
  return false;
}

/**
 * @param {[[{x,y,z}]]} loops - boundary loops of the reference maille
 * @param {object[]} rows - candidate maille records
 */
export default function findAdjacentMeshes3d(loops, rows) {
  if (!loops?.length || !rows?.length) return [];
  const bbox = bboxOfLoops(loops);
  return rows.filter((row) => {
    const rowLoops = getMesh3dLoops(row);
    return (
      rowLoops.length &&
      bboxesTouch(bbox, bboxOfLoops(rowLoops)) &&
      anyLoopsTouch(loops, rowLoops)
    );
  });
}
