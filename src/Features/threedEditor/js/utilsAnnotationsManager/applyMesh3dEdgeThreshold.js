import { Float32BufferAttribute } from "three";

import { CREASE_TIE_EPS_DEG } from "Features/threedEditor/utils/getGridEdgeThresholdDeg";

// Under this fold (degrees) two faces are coplanar: their common edge is a
// drawn split of one flat face, always shown.
const COPLANAR_SPLIT_DEG = 0.1;

// Is the edge a facet seam of a curved surface, hidden by the "Wireframe"
// crease threshold? Never a border / non-manifold edge (foldDeg null), nor a
// coplanar split (a feature drawn on a flat face), nor a real fold above the
// threshold. A fold of exactly the threshold is a seam (CREASE_TIE_EPS_DEG).
export function isMesh3dSeamHidden(foldDeg, thresholdDeg) {
  if (foldDeg === null || foldDeg === undefined) return false;
  if (!(foldDeg > COPLANAR_SPLIT_DEG)) return false;
  return foldDeg <= thresholdDeg + CREASE_TIE_EPS_DEG;
}

// Draws the edge lines of a mesh annotation (buildMesh3dAnnotationObject,
// gridEdgeKind "MESH3D") for a crease threshold: every edge of
// userData.mesh3dEdgePositions but the facet seams (userData.mesh3dEdgeFolds,
// isMesh3dSeamHidden). The pick / highlight side keeps reading the FULL edge
// list (userData.mesh3dEdges + mesh3dEdgePositions): a hidden seam is still a
// selectable edge.
export default function applyMesh3dEdgeThreshold(lines, thresholdDeg) {
  const all = lines?.userData?.mesh3dEdgePositions;
  const folds = lines?.userData?.mesh3dEdgeFolds;
  if (!all || !folds) return;
  const positions = [];
  for (let i = 0; i < folds.length; i++) {
    if (isMesh3dSeamHidden(folds[i], thresholdDeg)) continue;
    for (let k = 0; k < 6; k++) positions.push(all[6 * i + k]);
  }
  lines.geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3)
  );
  lines.geometry.computeBoundingSphere();
  lines.userData.appliedThresholdDeg = thresholdDeg;
}
