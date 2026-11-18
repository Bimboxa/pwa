import triangulatePiece from "../../threedCutLines/utils/triangulatePiece.js";

import coalesceCoplanarFaces from "./coalesceCoplanarFaces.js";
import { computeMesh3dSurface } from "./computeFaceArea.js";

// Geometry of the maille replacing N merged mailles. Pure (world
// coordinates).
//
// - planar mailles only → { faces }: coplanar faces that touch are unioned,
//   the others kept as they are (a maille is multi-face by design);
// - at least one curved (shell) maille → { shell }: the shells and the
//   triangulated planar faces gathered into ONE shell. Its borders are the
//   loops of the merged mailles, kept as they are: the mailles of two
//   annotations neither share welded edges (display shrink) nor a winding,
//   so a boundary walk over the gathered triangles (extractBoundaryLoops3d)
//   would return broken loops.
//
// Returns { faces, shell, surface }, or null when nothing can be built.
export default function mergeMesh3dGeometries(rows) {
  const list = (rows || []).filter(Boolean);
  if (!list.length) return null;

  const allFaces = list.flatMap((row) => row.faces || []);
  const hasShell = list.some((row) => row.shell?.positions?.length);

  if (!hasShell) {
    const faces = coalesceCoplanarFaces(allFaces);
    if (!faces?.length) return null;
    return { faces, shell: null, surface: computeMesh3dSurface(faces) };
  }

  const positions = [];
  const boundaries = [];
  let surface = computeMesh3dSurface(allFaces);
  const append = (values) => {
    for (let i = 0; i < values.length; i++) positions.push(values[i]);
  };
  for (const row of list) {
    if (!row.shell?.positions?.length) continue;
    append(row.shell.positions);
    boundaries.push(...(row.shell.boundaries || []));
    surface += row.shell.surface || 0;
  }
  for (const face of allFaces) {
    append(triangulatePiece(face));
    if (face?.contour?.length >= 3) boundaries.push(face.contour);
    for (const hole of face?.holes || []) {
      if (hole?.length >= 3) boundaries.push(hole);
    }
  }
  if (!positions.length) return null;

  return { faces: [], shell: { positions, boundaries, surface }, surface };
}
