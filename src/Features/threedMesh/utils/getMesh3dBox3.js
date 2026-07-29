import { Box3, Vector3 } from "three";

import getMesh3dLoops from "./getMesh3dLoops";

// World-coordinate bounding box of a maille, built from its stored boundary
// loops (both planar `faces` and curved `shell` models) — not from the scene
// objects, whose box would be inflated by the label sprite and leader.
// Returns null when the maille has no points.
export default function getMesh3dBox3(mesh3d) {
  const box = new Box3();
  box.makeEmpty();

  for (const loop of getMesh3dLoops(mesh3d)) {
    for (const point of loop) {
      box.expandByPoint(new Vector3(point.x, point.y, point.z));
    }
  }
  if (box.isEmpty()) return null;

  // A maille is a flat surface: give the box some thickness (and a floor for
  // degenerate tiny mailles) so cameraControls.fitToBox never gets a
  // zero-sized box.
  const size = box.getSize(new Vector3());
  if (Math.max(size.x, size.y, size.z) < 0.1) {
    box.expandByScalar(0.5);
  }
  return box;
}
