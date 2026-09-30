import { Vector3 } from "three";

import computePlaneBasis from "Features/threedMesh/utils/computePlaneBasis";

// Minimum rectangle side (m) — under this the two clicks are degenerate.
const MIN_SIDE_M = 1e-3;

// Rectangle from two diagonal 3D points on an arbitrary plane (a face of an
// annotation): the sides follow the plane's own axes — horizontal and "up
// the slope" (computePlaneBasis) — so a rectangle drawn on a wall stands
// upright. The cursor point is projected on the anchor's plane first.
// Twin of computeRectangleCorners, which works in a base map image frame.
//
// normal: plane normal (world). Returns [Vector3 x4] in order, or null.
export default function computeRectangleCornersOnPlane(
  anchorWorld,
  cursorWorld,
  normal
) {
  if (!anchorWorld || !cursorWorld || !normal) return null;
  const anchor = new Vector3(anchorWorld.x, anchorWorld.y, anchorWorld.z);
  const basis = computePlaneBasis(normal, anchor);
  const u = new Vector3(basis.u.x, basis.u.y, basis.u.z);
  const v = new Vector3(basis.v.x, basis.v.y, basis.v.z);

  const delta = new Vector3(cursorWorld.x, cursorWorld.y, cursorWorld.z).sub(
    anchor
  );
  const du = delta.dot(u);
  const dv = delta.dot(v);
  if (Math.abs(du) < MIN_SIDE_M || Math.abs(dv) < MIN_SIDE_M) return null;

  return [
    anchor.clone(),
    anchor.clone().addScaledVector(u, du),
    anchor.clone().addScaledVector(u, du).addScaledVector(v, dv),
    anchor.clone().addScaledVector(v, dv),
  ];
}
