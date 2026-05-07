import { Object3D, Vector3 } from "three";

import getBaseMapTransform, {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "./getBaseMapTransform";

// Inverse of `baseMapLocalToWorld` + `pixelToWorld`.
//
// Project a 3D world point onto the baseMap plane and return:
//   - { x, y } normalized coordinates in [0..1] against `baseMap.getImageSize()`
//     (the same coordinate space `db.points` is stored in)
//   - `offset`: signed distance from the baseMap plane along its local +Z
//     normal, in metres. Positive means "above" the plane.
//
// Returns `null` if the baseMap lacks a usable size or `meterByPx`.
export default function worldToBaseMapNormalized(worldPoint, baseMap) {
  if (!baseMap) return null;

  const imageSize =
    typeof baseMap.getImageSize === "function"
      ? baseMap.getImageSize()
      : baseMap.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const meterByPx =
    typeof baseMap.getMeterByPx === "function"
      ? baseMap.getMeterByPx()
      : baseMap.meterByPx;
  if (!meterByPx) return null;

  const transform = getBaseMapTransform(baseMap);

  const tmp = new Object3D();
  const euler = getBaseMapEuler(transform);
  tmp.rotation.order = BASE_MAP_ROTATION_ORDER;
  tmp.rotation.set(euler.x, euler.y, euler.z);
  tmp.position.set(
    transform.position.x,
    transform.position.y,
    transform.position.z
  );
  tmp.updateMatrixWorld(true);

  const local = tmp.worldToLocal(
    new Vector3(worldPoint.x, worldPoint.y, worldPoint.z)
  );

  // Inverse of `pixelToWorld`:
  //   x_local = (px - width/2)  * meterByPx
  //   y_local = -(py - height/2) * meterByPx
  const px = imageSize.width / 2 + local.x / meterByPx;
  const py = imageSize.height / 2 - local.y / meterByPx;

  return {
    x: px / imageSize.width,
    y: py / imageSize.height,
    offset: local.z,
  };
}
