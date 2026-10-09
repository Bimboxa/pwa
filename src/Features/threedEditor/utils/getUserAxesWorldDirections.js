import { Vector3 } from "three";

import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

const WORLD_UP = new Vector3(0, 1, 0);

// World-space unit directions of the displayed (user-facing) axes, for a
// frame rotated by `yawDeg` around the vertical axis.
//
// Before rotation (userCoords convention, Z up):
//   user X = world +X, user Y = world +Z, user Z = world +Y.
// X and Y are then rotated by yawDeg around world Y with the same sense as
// a base map's `angleDeg` (getBaseMapEuler → Euler(0, yawRad, 0)), so a frame
// set to a base map's angle has its X axis along that base map's local x.
// Z (vertical) is unaffected by the rotation.
//
// Returns [{ key, color, dir }] — shared by the orientation gizmo, the
// in-scene axes helper and the gizmo's face views.
export default function getUserAxesWorldDirections(yawDeg = 0) {
  const yawRad = ((Number(yawDeg) || 0) * Math.PI) / 180;
  return [
    {
      key: "X",
      color: AXIS_COLORS.X,
      dir: new Vector3(1, 0, 0).applyAxisAngle(WORLD_UP, yawRad),
    },
    {
      key: "Y",
      color: AXIS_COLORS.Y,
      dir: new Vector3(0, 0, 1).applyAxisAngle(WORLD_UP, yawRad),
    },
    { key: "Z", color: AXIS_COLORS.Z, dir: new Vector3(0, 1, 0) },
  ];
}
