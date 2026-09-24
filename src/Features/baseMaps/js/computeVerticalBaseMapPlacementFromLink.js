import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";

// Pose a VERTICAL base map (elevation / section drawing) in the main 3D
// referential from a BASE_MAP_LINK section mark drawn on a plan and its CLONE
// drawn on the elevation itself.
//
// Rule:
//   - the plan segment p1 → p2 gives the two world anchors A and B (same
//     height: the plan's altitude) and therefore the elevation's heading,
//   - the clone segment on the elevation gives where those anchors sit in the
//     elevation image; the observer stands in FRONT of the elevation and sees
//     local +X to the RIGHT, so the LEFT clone point lands on A and the
//     RIGHT one on B — whatever the drawing order of the clone,
//   - the elevation SCALE is recomputed so the clone length matches |AB|
//     (px-only ratio => idempotent across re-runs),
//   - the vertical spread between the two clone points is ignored (mean y).
//
// Geometry: for a VERTICAL base map of angle `a` (see getBaseMapEuler), the
// local +X axis maps to the world direction u = (cos a, 0, -sin a) and the
// local +Y axis maps to world +Y, so a local point (lx, ly) lands on
//   world = position + lx * u + ly * (0, 1, 0)
// The front normal is n = (sin a, 0, cos a): on a horizontal plan this is the
// screen-RIGHT side of the p1 → p2 direction, i.e. the observer side drawn by
// the section mark's arrows.
//
// Normalized inputs are {x, y} in [0..1] (same space as `db.points`).
//
// Returns `{ angleDeg, position: {x, y, z}, meterByPx }`, or `null` when the
// inputs are insufficient (wrong orientations, missing sizes / scale,
// degenerate segments).
const EPS = 1e-9;
const EPS_PX = 1e-6;

const getSize = (baseMap) =>
  typeof baseMap?.getImageSize === "function"
    ? baseMap.getImageSize()
    : baseMap?.image?.imageSize;

export default function computeVerticalBaseMapPlacementFromLink({
  planBaseMap,
  elevationBaseMap,
  planNorm,
  cloneNorm,
}) {
  if (!planBaseMap || !elevationBaseMap) return null;
  if (!planNorm?.p1 || !planNorm?.p2) return null;
  if (!cloneNorm?.q1 || !cloneNorm?.q2) return null;
  if (planBaseMap.orientation === "VERTICAL" || planBaseMap.isPhoto)
    return null;
  if (elevationBaseMap.orientation !== "VERTICAL") return null;

  // --- plan: world anchors of the section mark ---

  const A = baseMapNormalizedToWorld(planNorm.p1, planBaseMap);
  const B = baseMapNormalizedToWorld(planNorm.p2, planBaseMap);
  if (!A || !B) return null;

  const dx = B.x - A.x;
  const dz = B.z - A.z;
  const L = Math.hypot(dx, dz);
  if (L < EPS) return null;

  // --- elevation: clone endpoints in image px, left → right ---

  const size = getSize(elevationBaseMap);
  if (!size?.width || !size?.height) return null;
  const { width: W, height: H } = size;

  const qa = { x: cloneNorm.q1.x * W, y: cloneNorm.q1.y * H };
  const qb = { x: cloneNorm.q2.x * W, y: cloneNorm.q2.y * H };
  const left = qa.x <= qb.x ? qa : qb;
  const right = qa.x <= qb.x ? qb : qa;
  const deltaPx = right.x - left.x;
  if (deltaPx < EPS_PX) return null;

  // --- scale: the clone spans exactly |AB| ---

  const meterByPx = L / deltaPx;

  // --- heading: local +X follows A → B ---

  const ux = dx / L;
  const uz = dz / L;
  const angleRad = Math.atan2(-uz, ux);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // --- position: anchor the LEFT clone point on A ---

  const yMean = (left.y + right.y) / 2;
  const lLeft = {
    x: (left.x - W / 2) * meterByPx,
    y: -(yMean - H / 2) * meterByPx,
  };

  return {
    angleDeg: (angleRad * 180) / Math.PI,
    position: {
      x: A.x - lLeft.x * cos,
      y: A.y - lLeft.y,
      z: A.z + lLeft.x * sin,
    },
    meterByPx,
  };
}
