import computeFaceArea from "./computeFaceArea.js";
import getShellCentroid from "./getShellCentroid.js";

// Nearest-bucket split at 45°: a maille whose dominant normal is within 45°
// of the world up axis (Y-up) is HORIZONTAL (floor/roof-like), otherwise
// VERTICAL (wall-like).
const HORIZONTAL_MIN_ABS_DOT_Y = Math.SQRT1_2;

/**
 * Orientation of a maille, derived at read time (never stored) from its
 * dominant normal: the largest planar face for the planar model, the
 * area-weighted average normal for a curved shell. Degenerate mailles
 * (no usable normal) default to HORIZONTAL so every maille lands in a group.
 *
 * @returns {"HORIZONTAL"|"VERTICAL"}
 */
export default function getMesh3dOrientation(mesh3d) {
  let n = null;
  if (mesh3d?.shell?.positions?.length) {
    n = getShellCentroid(mesh3d.shell.positions)?.normal;
  } else {
    let bestArea = -1;
    for (const face of mesh3d?.faces || []) {
      const area = computeFaceArea(face);
      if (area > bestArea) {
        bestArea = area;
        n = face.normal;
      }
    }
  }
  if (!n) return "HORIZONTAL";
  return Math.abs(n.y) >= HORIZONTAL_MIN_ABS_DOT_Y ? "HORIZONTAL" : "VERTICAL";
}
