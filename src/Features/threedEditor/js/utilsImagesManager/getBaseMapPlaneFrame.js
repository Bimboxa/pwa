import { Box3, Quaternion, Vector3 } from "three";

import { buildBaseMapPlaneGeometry } from "./createImageObject";

// World-space framing data for a basemap plane — `{box, normal}`, ready for
// ControlsManager.fitToBox3Facing. `null` when the group carries no usable
// plane placement (scale-less basemap, degenerate size).
export default function getBaseMapPlaneFrame(group) {
  if (!group) return null;
  group.updateMatrixWorld(true);

  // The image mesh alone — NOT the group: annotations are attached as children
  // of the same group and would inflate the box. `setFromObject` ignores
  // visibility, so a basemap whose image is hidden (meshWrap.visible = false)
  // still frames correctly.
  let mesh = null;
  group.userData?.meshWrap?.traverse?.((child) => {
    if (!mesh && child.userData?.isBasemap) mesh = child;
  });

  const box = new Box3();
  if (mesh) {
    box.setFromObject(mesh);
  } else {
    // Texture not attached yet (pending load, failed blob URL): rebuild the
    // plane geometry from the pixel-space placement stashed on the group —
    // same math as the real mesh.
    const planePx = group.userData?.planePx;
    const meterByPx = group.userData?.meterByPx;
    if (!planePx || !Number.isFinite(meterByPx) || meterByPx <= 0) return null;
    const geometry = buildBaseMapPlaneGeometry({ ...planePx, meterByPx });
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) {
      geometry.dispose();
      return null;
    }
    box.copy(geometry.boundingBox).applyMatrix4(group.matrixWorld);
    geometry.dispose();
  }

  if (box.isEmpty() || !isFinite(box.min.x)) return null;
  // A plane below the centimetre isn't a real placement (missing meterByPx):
  // framing it would park the camera on a point.
  const size = box.getSize(new Vector3());
  if (Math.max(size.x, size.y, size.z) < 0.01) return null;

  // Local +Z is the PlaneGeometry facing direction; the version transform only
  // rotates the plane around Z, so it doesn't affect the normal.
  const normal = new Vector3(0, 0, 1)
    .applyQuaternion(group.getWorldQuaternion(new Quaternion()))
    .normalize();

  return { box, normal };
}
