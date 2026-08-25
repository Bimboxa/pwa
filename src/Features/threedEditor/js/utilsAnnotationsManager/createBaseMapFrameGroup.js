import { Group } from "three";

import {
  getBaseMapEuler,
  BASE_MAP_ROTATION_ORDER,
} from "Features/baseMaps/js/getBaseMapTransform";

/**
 * An empty Group carrying a base map's world placement — the same transform
 * createImageObject puts on the real basemap Group.
 *
 * Used as a stand-in when geometry must sit in a base map's frame but that map
 * is NOT loaded in the 3D scene (imagesManager only knows displayed maps). A
 * cross-base-map subtraction target is the typical case: the wall is displayed,
 * the opening's own plan usually is not.
 *
 * @param {{orientation:string, angleDeg:number, position:{x,y,z}}} transform
 *   as returned by getBaseMapTransform
 */
export default function createBaseMapFrameGroup(transform) {
  const group = new Group();
  if (!transform) return group;
  const euler = getBaseMapEuler(transform);
  group.rotation.order = BASE_MAP_ROTATION_ORDER;
  group.position.set(
    transform.position?.x ?? 0,
    transform.position?.y ?? 0,
    transform.position?.z ?? 0
  );
  group.rotation.set(euler.x, euler.y, euler.z);
  group.updateMatrixWorld(true);
  return group;
}
