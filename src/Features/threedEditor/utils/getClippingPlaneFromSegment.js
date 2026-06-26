import { Vector3, Euler, Quaternion, Matrix4 } from "three";

import getBaseMapTransform, {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";

// Project a 2D segment drawn on the baseMap (top view) onto the 3D scene to get
// the orientation + position of a VERTICAL cutting plane that contains the
// segment line. Returns { normal, point } in three.js world coords, ready for
// ClippingManager.setFromWorldNormalAndPoint.
//
// pointA / pointB are NORMALIZED [0..1] vs baseMap imageSize. The math mirrors
// how annotations are placed in 3D: pixelToWorld (local plane coords) + the
// baseMap group transform (getBaseMapTransform / getBaseMapEuler, order YXZ).
export default function getClippingPlaneFromSegment({
  baseMap,
  pointA,
  pointB,
  sign = 1,
}) {
  const imageSize = baseMap?.image?.imageSize;
  const meterByPx = baseMap?.meterByPx;
  if (!imageSize?.width || !meterByPx || !pointA || !pointB) return null;

  const localBaseMap = {
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    meterByPx,
  };

  // normalized → image px → local plane coords (z = 0, plane lies on group XY)
  const toLocal = (p) => {
    const local = pixelToWorld(
      { x: p.x * imageSize.width, y: p.y * imageSize.height },
      localBaseMap
    );
    return new Vector3(local.x, local.y, 0);
  };

  // baseMap group world transform
  const t = getBaseMapTransform(baseMap);
  const euler = getBaseMapEuler(t);
  const quaternion = new Quaternion().setFromEuler(
    new Euler(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
  );
  const matrix = new Matrix4().compose(
    new Vector3(t.position.x, t.position.y, t.position.z),
    quaternion,
    new Vector3(1, 1, 1)
  );

  const wa = toLocal(pointA).applyMatrix4(matrix);
  const wb = toLocal(pointB).applyMatrix4(matrix);

  const dir = new Vector3().subVectors(wb, wa);
  if (dir.lengthSq() === 0) return null;
  dir.normalize();

  // vertical cutting plane: normal is horizontal, perpendicular to the segment.
  const up = new Vector3(0, 1, 0);
  const normal = new Vector3().crossVectors(dir, up);
  if (normal.lengthSq() === 0) return null;
  normal.normalize().multiplyScalar(sign >= 0 ? 1 : -1);

  const point = new Vector3().addVectors(wa, wb).multiplyScalar(0.5);

  return { normal, point };
}
