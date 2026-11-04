import { Euler, Vector3 } from "three";

import getBaseMapTransform, {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "./getBaseMapTransform.js";

// World-space normal of a base map from its DB row (orientation + angleDeg):
// the basemap-local +Z axis, the one annotation heights are extruded along.
// Same vector as threedDrawing/utils/getBaseMapNormalWorld, which reads it
// from the posed scene group — this one needs no scene (services, replays).
// A horizontal base map gives world +Y.
//
// Returns a plain { x, y, z } unit vector.
export default function getBaseMapNormalWorldFromRow(baseMap) {
  const transform = getBaseMapTransform(baseMap);
  const e = getBaseMapEuler(transform);
  const n = new Vector3(0, 0, 1)
    .applyEuler(new Euler(e.x, e.y, e.z, BASE_MAP_ROTATION_ORDER))
    .normalize();
  return { x: n.x, y: n.y, z: n.z };
}
