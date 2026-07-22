// Boundary loops of a maille, whatever its geometry model: the contour + hole
// loops of its planar faces, or the boundary loops of its curved shell.
// World coordinates, open loops (no closing duplicate).
export default function getMesh3dLoops(mesh3d) {
  const loops = [];
  for (const face of mesh3d?.faces || []) {
    if (face?.contour?.length >= 2) loops.push(face.contour);
    for (const hole of face.holes || []) {
      if (hole?.length >= 2) loops.push(hole);
    }
  }
  for (const loop of mesh3d?.shell?.boundaries || []) {
    if (loop?.length >= 2) loops.push(loop);
  }
  return loops;
}
