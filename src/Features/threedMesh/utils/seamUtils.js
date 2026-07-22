// Seams of a maille: the world-space segments where a previous cut opened it
// without separating it (cutting a closed 360° ribbon once turns it into an
// open ribbon — still ONE maille, but no longer connected across the cut).
//
// Stored on the record as `seams: [[{x,y,z},{x,y,z}], ...]`. Every "is this
// maille still in one piece?" walk must treat a seam edge as a boundary,
// otherwise a second cut elsewhere would find the ribbon connected the long
// way round and never split it.
//
// Pure (no three.js), world coordinates.

// Same order as findAdjacentMeshes3d: a millimetre of slack absorbs the float
// noise of successive clips.
export const SEAM_TOL_M = 1e-3;

export function distSqPointToSegment3d(p, a, b) {
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

export function isPointOnSeams(p, seams, tol = SEAM_TOL_M) {
  const tolSq = tol * tol;
  for (const [a, b] of seams || []) {
    if (distSqPointToSegment3d(p, a, b) <= tolSq) return true;
  }
  return false;
}

// An edge lies on a seam when both endpoints AND its midpoint do: a long edge
// grazing two distinct seams at its ends is not itself a seam.
export function isEdgeOnSeams(p, q, seams, tol = SEAM_TOL_M) {
  if (!seams?.length) return false;
  const mid = {
    x: (p.x + q.x) / 2,
    y: (p.y + q.y) / 2,
    z: (p.z + q.z) / 2,
  };
  return (
    isPointOnSeams(p, seams, tol) &&
    isPointOnSeams(q, seams, tol) &&
    isPointOnSeams(mid, seams, tol)
  );
}

// Seams still carried by a piece after a split — those running through its
// geometry, matched on its VERTICES: on a polygon maille a seam ends up on the
// boundary of the pieces it separated, but on a shell it stays INTERIOR (both
// sides remain welded when the cut only opened the maille), so a
// boundary-based test would drop it and the next cut would find the ribbon
// closed again.
//
// A seam is kept when one of its ends or its middle lands on a vertex of the
// piece: a later cut crossing a seam hands each half to a different piece, and
// both must stay open along it.
export function filterSeamsForPoints(seams, points, tol = SEAM_TOL_M) {
  if (!seams?.length || !points?.length) return [];

  // Quantized vertex lookup: seam ends come from the very same clip
  // arithmetic as the vertices, so a grid probe is exact enough and keeps the
  // filter O(1) per point instead of O(vertices).
  const cell = (v) => Math.round(v / tol);
  const key = (p) => `${cell(p.x)},${cell(p.y)},${cell(p.z)}`;
  const grid = new Set();
  for (const p of points) grid.add(key(p));

  const nearVertex = (p) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const probe = `${cell(p.x) + dx},${cell(p.y) + dy},${cell(p.z) + dz}`;
          if (grid.has(probe)) return true;
        }
      }
    }
    return false;
  };

  return seams.filter(([a, b]) => {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    return nearVertex(a) || nearVertex(b) || nearVertex(mid);
  });
}
