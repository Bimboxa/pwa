import computeFaceArea, { polygonCentroid2d } from "./computeFaceArea";
import computePlaneBasis from "./computePlaneBasis";
import getShellCentroid from "./getShellCentroid";
import { projectLoopTo2d, liftPointTo3d } from "./planeProjection";
import { add, scale } from "./vec3Utils";

// Lift of the label sprite off the maille plane (meters).
export const LABEL_LIFT_M = 0.05;

/**
 * Anchor frame of a maille label:
 * - `base`: default label position — centroid of the maille's largest face
 *   (or the area-weighted centroid of a curved shell), lifted along the
 *   normal;
 * - `u` / `v`: orthonormal in-plane axes the user-defined `labelOffset` is
 *   expressed in (meters), `n`: the plane normal.
 *
 * The basis only depends on the plane normal (computePlaneBasis is
 * deterministic), so a persisted offset keeps the same meaning across
 * rebuilds and sessions.
 *
 * @returns {{base, u, v, n}|null}
 */
export default function getMesh3dLabelAnchor(mesh3d) {
  if (mesh3d?.shell?.positions?.length) {
    const shell = getShellCentroid(mesh3d.shell.positions);
    if (!shell) return null;
    const basis = computePlaneBasis(shell.normal, shell.centroid);
    return {
      base: add(shell.centroid, scale(shell.normal, LABEL_LIFT_M)),
      u: basis.u,
      v: basis.v,
      n: basis.n,
    };
  }

  let best = null;
  let bestArea = -1;
  for (const face of mesh3d?.faces || []) {
    const area = computeFaceArea(face);
    if (area > bestArea) {
      bestArea = area;
      best = face;
    }
  }
  if (!best) return null;

  const basis = computePlaneBasis(best.normal, best.contour[0]);
  const centroid2d = polygonCentroid2d(projectLoopTo2d(best.contour, basis));
  const centroid = liftPointTo3d(centroid2d, basis);
  return {
    base: add(centroid, scale(basis.n, LABEL_LIFT_M)),
    u: basis.u,
    v: basis.v,
    n: basis.n,
  };
}

/**
 * Point of the anchor plane at `offset` = {u, v} in meters from the anchor
 * base. Used for both ends of the label leader: the card (`labelOffset`) and
 * the pointed target (`labelTargetOffset`).
 */
export function getMesh3dPlanePoint(anchor, offset) {
  if (!anchor) return null;
  const du = Number(offset?.u) || 0;
  const dv = Number(offset?.v) || 0;
  if (!du && !dv) return { ...anchor.base };
  return add(anchor.base, add(scale(anchor.u, du), scale(anchor.v, dv)));
}

/**
 * Normalized {u, v} offset (never null, meters) as persisted on a maille.
 */
export function readMesh3dOffset(offset) {
  return {
    u: Number(offset?.u) || 0,
    v: Number(offset?.v) || 0,
  };
}
