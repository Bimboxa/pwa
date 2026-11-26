import getBaseMapNormalWorldFromRow from "../../baseMaps/js/getBaseMapNormalWorldFromRow.js";
import getBaseMapTransform from "../../baseMaps/js/getBaseMapTransform.js";

import getBaseMapClipping3d from "./getBaseMapClipping3d.js";

// World-space planes of the clipping slab of a base map (see
// getBaseMapClipping3d), in the three.js convention: a point p is KEPT by a
// plane when normal·p + constant ≥ 0.
//
// With n the base map normal (its "front" side) and P a point of its plane,
// the signed distance of p to the base map is d = n·(p − P):
//   - front plane keeps d ≤ frontM : (−n)·p + (n·P + frontM) ≥ 0
//   - back plane keeps d ≥ −backM  :   n·p + (backM − n·P) ≥ 0
// A null depth leaves that side open (no plane).
//
// Returns [{ side: "front" | "back", normal: {x, y, z}, constant }] (0, 1 or
// 2 planes).
export default function getBaseMapClipSlabPlanes(baseMap) {
  const { frontM, backM } = getBaseMapClipping3d(baseMap);
  const n = getBaseMapNormalWorldFromRow(baseMap);
  const { position } = getBaseMapTransform(baseMap);
  const nDotP = n.x * position.x + n.y * position.y + n.z * position.z;

  const planes = [];
  if (frontM !== null) {
    planes.push({
      side: "front",
      normal: { x: -n.x, y: -n.y, z: -n.z },
      constant: nDotP + frontM,
    });
  }
  if (backM !== null) {
    planes.push({
      side: "back",
      normal: { x: n.x, y: n.y, z: n.z },
      constant: backM - nDotP,
    });
  }
  return planes;
}
