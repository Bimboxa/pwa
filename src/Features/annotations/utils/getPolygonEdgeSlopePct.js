// Slope (%) of a polygon face implied by one of its edges when the rest of
// the polygon's vertices are treated as fixed reference.
//
// Convention (matches the user-facing UX in MoveGizmoThreed):
//   - F = centroid (in meters) of the polygon's vertices that are NOT part
//         of the moved edge; z_F = their average offsetTop.
//   - M = midpoint (in meters) of the moved edge's two vertices; z_M =
//         their average offsetTop.
//   - L = horizontal distance from F to M in meters.
//   - slope% = 100 * (z_M - z_F) / L.
//
// Positive slope -> the moved edge is HIGHER than the fixed centroid
// ("ça monte"). Negative -> lower ("ça descend").
//
// Inputs are expressed in PIXEL coordinates (like getPolygonSlope.js /
// getPolygonZPlane.js); the conversion to meters happens here via meterByPx.

function splitEdgeVsFixed(points, edgePointIds) {
  const ids = new Set(edgePointIds || []);
  const edgePoints = [];
  const fixedPoints = [];
  for (const p of points || []) {
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
    if (p.isSliding) continue;
    if (ids.has(p.id)) edgePoints.push(p);
    else fixedPoints.push(p);
  }
  return { edgePoints, fixedPoints };
}

function centroid(points) {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumZ += p.offsetTop ?? 0;
  }
  const n = points.length;
  return { x: sumX / n, y: sumY / n, z: sumZ / n };
}

// Returns the current slope % implied by the polygon's vertices, with the
// given two edge ids treated as the moved edge. Returns null when the slope
// is undefined (degenerate geometry).
export function getPolygonEdgeSlopePct({ points, edgePointIds, meterByPx }) {
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  const { edgePoints, fixedPoints } = splitEdgeVsFixed(points, edgePointIds);
  if (edgePoints.length !== 2 || fixedPoints.length < 1) return null;
  const F = centroid(fixedPoints);
  const M = centroid(edgePoints);
  const dxPx = M.x - F.x;
  const dyPx = M.y - F.y;
  const L = Math.hypot(dxPx, dyPx) * meterByPx;
  if (!Number.isFinite(L) || L < 1e-6) return null;
  return (100 * (M.z - F.z)) / L;
}

// Returns the Δz (in meters) that, when added to the moved edge's current
// average `offsetTop`, produces the requested slope %. Returns null when
// the slope mode does not apply (degenerate geometry).
//
// `currentEdgeZ` is the moved edge's average offsetTop BEFORE the gizmo's
// live delta is applied (captured at the moment the user enters move mode).
// This makes the conversion stable across live drag updates.
export function deltaZForTargetSlope({
  points,
  edgePointIds,
  meterByPx,
  targetSlopePct,
  currentEdgeZ,
}) {
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  if (!Number.isFinite(targetSlopePct)) return null;
  if (!Number.isFinite(currentEdgeZ)) return null;
  const { edgePoints, fixedPoints } = splitEdgeVsFixed(points, edgePointIds);
  if (edgePoints.length !== 2 || fixedPoints.length < 1) return null;
  const F = centroid(fixedPoints);
  const M = centroid(edgePoints);
  const dxPx = M.x - F.x;
  const dyPx = M.y - F.y;
  const L = Math.hypot(dxPx, dyPx) * meterByPx;
  if (!Number.isFinite(L) || L < 1e-6) return null;
  const targetZ = F.z + (targetSlopePct / 100) * L;
  return targetZ - currentEdgeZ;
}

export default getPolygonEdgeSlopePct;
