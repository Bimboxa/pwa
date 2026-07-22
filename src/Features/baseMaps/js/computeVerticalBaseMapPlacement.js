import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";

// Place a VERTICAL baseMap (elevation / section drawing) in the main 3D
// referential from two calibration targets pointed BOTH on a plan view
// (horizontal baseMap, in the 2D editor) and on the elevation itself.
//
// Rule (see the "Localiser le fond de plan" panel):
//   - the REFERENCE target drives the horizontal placement (position.x/z) and,
//     together with the user-entered absolute height, the vertical one
//     (position.y),
//   - the OTHER target only drives the rotation around the vertical axis
//     (angleDeg).
// The elevation's scale (`meterByPx`) is never touched.
//
// Targets are relative {x, y} in [0..1] (same space as `db.points`).
//
// Geometry: for a VERTICAL baseMap of angle `a` (see getBaseMapEuler), the
// local +X axis maps to the world direction u = (cos a, 0, -sin a) and the
// local +Y axis maps to world +Y. So a local point (lx, ly) lands on
//   world = position + lx * u + ly * (0, 1, 0)
//
// Returns `{ angleDeg, position: {x, y, z} }`, or `null` when the inputs are
// insufficient (missing sizes/meterByPx, superimposed plan targets, elevation
// targets sharing the same abscissa => undetermined angle).
const EPS = 1e-9;

export default function computeVerticalBaseMapPlacement({
  planBaseMap,
  planTargets,
  elevationBaseMap,
  elevationTargets,
  refColor,
  refHeight,
}) {
  if (!planBaseMap || !elevationBaseMap) return null;
  if (!planTargets || !elevationTargets) return null;
  if (!Number.isFinite(refHeight)) return null;

  const otherColor = refColor === "red" ? "green" : "red";

  // --- plan view: world points of the two targets (XZ used only) ---

  const P = baseMapNormalizedToWorld(planTargets[refColor], planBaseMap);
  const Q = baseMapNormalizedToWorld(planTargets[otherColor], planBaseMap);
  if (!P || !Q) return null;

  const dx = Q.x - P.x;
  const dz = Q.z - P.z;
  const d = Math.hypot(dx, dz);
  if (d < EPS) return null;

  // --- elevation: targets in local metres (image center = origin) ---

  const imageSize =
    typeof elevationBaseMap.getImageSize === "function"
      ? elevationBaseMap.getImageSize()
      : elevationBaseMap.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const meterByPx =
    typeof elevationBaseMap.getMeterByPx === "function"
      ? elevationBaseMap.getMeterByPx()
      : elevationBaseMap.meterByPx;
  if (!meterByPx) return null;

  // Same pixel mapping as baseMapNormalizedToWorld.
  const toLocal = (rel) => {
    if (!rel) return null;
    return {
      x: (rel.x * imageSize.width - imageSize.width / 2) * meterByPx,
      y: -(rel.y * imageSize.height - imageSize.height / 2) * meterByPx,
    };
  };

  const lRef = toLocal(elevationTargets[refColor]);
  const lOther = toLocal(elevationTargets[otherColor]);
  if (!lRef || !lOther) return null;

  const deltaLx = lOther.x - lRef.x;
  if (Math.abs(deltaLx) < EPS) return null;

  // --- rotation: local +X must point along the ref -> other direction ---

  const sign = deltaLx > 0 ? 1 : -1;
  const ux = (sign * dx) / d;
  const uz = (sign * dz) / d;
  const angleRad = Math.atan2(-uz, ux);

  // --- position: anchor the reference target ---

  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return {
    angleDeg: (angleRad * 180) / Math.PI,
    position: {
      x: P.x - lRef.x * cos,
      y: refHeight - lRef.y,
      z: P.z + lRef.x * sin,
    },
  };
}
