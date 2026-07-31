import baseMapLocalToWorld from "./baseMapLocalToWorld";
import getBaseMapTransform from "./getBaseMapTransform";

// Place a VERTICAL baseMap (elevation / section) in the main 3D referential
// from a plan-view REVOLUTION_AXIS plus the point where the user dropped that
// axis on the elevation.
//
// Sibling of `computeVerticalBaseMapPlacement` (the two-calibration-target
// solver) and deliberately built on the same formula — only the way the anchor
// and the direction are obtained differs:
//   - the axis CENTRE gives the horizontal anchor (position.x / z),
//   - the axis OFFSET Z gives the vertical one (position.y),
//   - the axis DIAMETER direction gives the rotation (angleDeg),
//     signed so the ORANGE half-disc ends up BEHIND the placed plane.
// The elevation's scale (`meterByPx`) is never touched.
//
// Geometry (identical to the sibling solver): for a VERTICAL baseMap of angle
// `a`, local +X maps to the world direction u = (cos a, 0, −sin a) and local +Y
// maps to world +Y, so a local point (lx, ly) lands on
//   world = position + lx·u + ly·(0,1,0)
//
// Returns `{ angleDeg, position: {x, y, z} }`, or `null` when the inputs are
// insufficient (missing sizes / meterByPx, wrong orientations, bad numbers).

// The +90°-CCW side of the diameter in the plan LOCAL frame is the −normal side
// of the placed plane — an exact identity (see getRevolutionAxisPlanFrame). The
// probe below re-checks it numerically so a future change to getBaseMapEuler
// can't silently invert the convention.
const ORANGE_PROBE_MIN = 0.99;

const toLocalMetres = (rel, imageSize, meterByPx) => ({
  x: (rel.x * imageSize.width - imageSize.width / 2) * meterByPx,
  y: -(rel.y * imageSize.height - imageSize.height / 2) * meterByPx,
});

const getSize = (baseMap) =>
  typeof baseMap?.getImageSize === "function"
    ? baseMap.getImageSize()
    : baseMap?.image?.imageSize;

const getScale = (baseMap) =>
  typeof baseMap?.getMeterByPx === "function"
    ? baseMap.getMeterByPx()
    : baseMap?.meterByPx;

/**
 * @param {Object} params
 * @param {Object} params.axis  { centerNorm:{x,y}, directionDeg, invertHalf, offsetZ }
 * @param {Object} params.planBaseMap        HORIZONTAL base map hosting the axis
 * @param {Object} params.elevationBaseMap   VERTICAL base map being placed
 * @param {{x:number,y:number}} params.clickNorm  drop point on the elevation, [0..1]
 */
export default function computeVerticalBaseMapPlacementFromAxis({
  axis,
  planBaseMap,
  elevationBaseMap,
  clickNorm,
}) {
  if (!axis?.centerNorm || !clickNorm) return null;
  if (!planBaseMap || !elevationBaseMap) return null;
  if (getBaseMapTransform(planBaseMap).orientation === "VERTICAL") return null;
  if (getBaseMapTransform(elevationBaseMap).orientation !== "VERTICAL")
    return null;

  const planSize = getSize(planBaseMap);
  const planMeterByPx = getScale(planBaseMap);
  if (!planSize?.width || !planSize?.height || !planMeterByPx) return null;

  const elevSize = getSize(elevationBaseMap);
  const elevMeterByPx = getScale(elevationBaseMap);
  if (!elevSize?.width || !elevSize?.height || !elevMeterByPx) return null;

  const offsetZ = Number(axis.offsetZ) || 0;
  if (!Number.isFinite(offsetZ)) return null;

  // --- 1. world anchor: the axis centre on the plan ---

  const planTransform = getBaseMapTransform(planBaseMap);
  const cLocal = toLocalMetres(axis.centerNorm, planSize, planMeterByPx);
  const A = baseMapLocalToWorld(cLocal, planTransform);
  if (!A) return null;

  // --- 2. world direction of the diameter, by PROBE ---
  // Probing baseMapLocalToWorld instead of re-deriving the trig keeps the plan
  // base map's own angleDeg and the y-down image convention in exactly one
  // place. `d` is a unit vector in the plan local frame, so B − A is already
  // unit-length in world (a HORIZONTAL base map has no vertical component).

  const theta =
    ((Number(axis.directionDeg) || 0) * Math.PI) / 180 +
    (axis.invertHalf ? Math.PI : 0);
  const d = { x: Math.cos(theta), y: Math.sin(theta) };

  const B = baseMapLocalToWorld(
    { x: cLocal.x + d.x, y: cLocal.y + d.y },
    planTransform
  );
  if (!B) return null;

  const dx = B.x - A.x;
  const dz = B.z - A.z;
  const dLen = Math.hypot(dx, dz);
  if (!(dLen > 1e-9)) return null;

  // --- 3. rotation: the placed local +X follows the diameter ---

  const angleRad = Math.atan2(-dz / dLen, dx / dLen);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Numeric guard on the orange-half convention: the +90°-CCW local point must
  // land on the −normal side, n = (sin a, 0, cos a).
  const orangeProbe = baseMapLocalToWorld(
    { x: cLocal.x - d.y, y: cLocal.y + d.x },
    planTransform
  );
  const towardsBehind =
    (orangeProbe.x - A.x) * -sin + (orangeProbe.z - A.z) * -cos;
  if (towardsBehind < ORANGE_PROBE_MIN) {
    console.error(
      "[computeVerticalBaseMapPlacementFromAxis] orange-half convention broken",
      towardsBehind
    );
  }

  // --- 4. position: anchor the drop point on the axis centre ---

  const lClick = toLocalMetres(clickNorm, elevSize, elevMeterByPx);

  return {
    angleDeg: (angleRad * 180) / Math.PI,
    position: {
      x: A.x - lClick.x * cos,
      y: offsetZ - lClick.y,
      z: A.z + lClick.x * sin,
    },
  };
}
