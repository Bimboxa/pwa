import { Matrix4, Vector3 } from "three";

import locateFaceNearHit from "../utils/locateFaceNearHit";
import { worldToMesh3dLocal } from "./getEditableMesh3d";

// Face of an editable mesh under a hit taken on the DISPLAYED object. A
// conversion reads the un-shrunk object (getEditableMesh3d), whose faces may
// sit up to 10 mm away from a shrunk display (5 mm for the top): the face is
// re-detected as the parallel one within 20 mm whose outline holds the point
// (locateFaceNearHit), not by an exact 2 mm on-face test. The view ray
// (camera → hit) keeps a thin band's shrunk top on the top face.
//
// ctx: { mesh, baseMapGroup, baseOffsetZ } (getEditableMesh3d /
// getDisplayedMesh3d). Returns the face index or -1.
export default function locateHitFaceOnMesh3d(ctx, intersect, camera) {
  const point = worldToMesh3dLocal(intersect.point, ctx);
  let rayDir = null;
  if (camera) {
    const origin = camera.isOrthographicCamera
      ? intersect.point.clone().sub(camera.getWorldDirection(new Vector3()))
      : camera.getWorldPosition(new Vector3());
    const from = worldToMesh3dLocal(origin, ctx);
    rayDir = {
      x: point.x - from.x,
      y: point.y - from.y,
      z: point.z - from.z,
    };
  }
  let normal = null;
  if (intersect.face?.normal && intersect.object) {
    // The hit object's matrixWorld as picked: the object may since have been
    // replaced (un-shrunk rebuild) and detached — never recompute it.
    ctx.baseMapGroup.updateWorldMatrix(true, false);
    const local = intersect.face.normal
      .clone()
      .transformDirection(intersect.object.matrixWorld)
      .transformDirection(
        new Matrix4().copy(ctx.baseMapGroup.matrixWorld).invert()
      );
    normal = { x: local.x, y: local.y, z: local.z };
  }
  return locateFaceNearHit(ctx.mesh, point, normal, undefined, { rayDir });
}
