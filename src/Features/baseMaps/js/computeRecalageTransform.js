import getBaseMapTransform from "./getBaseMapTransform";
import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";

// Recompute a baseMap's placement in the main 3D referential so that its
// calibration targets coincide with the corresponding targets on a reference
// baseMap.
//
// Behaviour (`meterByPx` is NEVER changed; `position.y` height is kept):
//   - 1 cible  -> translation only (position.x/z); angleDeg unchanged.
//   - 2 cibles -> translation + rotation around the vertical axis (angleDeg).
//     The REFERENCE target (`refColor`) anchors the translation; the OTHER
//     target only drives the rotation so that the ref -> other direction
//     matches the one observed on the reference baseMap (world XZ plane).
//
// Targets are relative {x, y} in [0..1] (same space as `db.points`).
//
// Returns `{ position: {x, y, z}, angleDeg }` or `null` when the inputs are
// insufficient (no usable target, missing sizes/meterByPx, superimposed
// targets => undetermined angle).
const EPS = 1e-9;

function normalizeAngleDeg(deg) {
  let a = ((deg + 180) % 360) - 180;
  if (a <= -180) a += 360;
  return a;
}

export default function computeRecalageTransform({
  currentBaseMap,
  refBaseMap,
  currentTargets,
  refTargets,
  useRed,
  useGreen,
  refColor = "red",
}) {
  if (!currentBaseMap || !refBaseMap) return null;
  if (!currentTargets || !refTargets) return null;
  if (!useRed && !useGreen) return null;

  const transform = getBaseMapTransform(currentBaseMap);
  const h = transform.position.y;
  const meterByPx =
    typeof currentBaseMap.getMeterByPx === "function"
      ? currentBaseMap.getMeterByPx()
      : currentBaseMap.meterByPx;
  if (!meterByPx) return null;

  // Probe helper: world point of one of the *current* baseMap's targets, with
  // a chosen angleDeg and the placement pinned at {x:0, z:0} (height kept).
  const currentWorldAtOrigin = (rel, angleDeg) =>
    baseMapNormalizedToWorld(rel, currentBaseMap, {
      meterByPx,
      transform: { ...transform, angleDeg, position: { x: 0, y: h, z: 0 } },
    });

  // --- 2 cibles: translation + rotation ---
  if (useRed && useGreen) {
    const anchor = refColor === "green" ? "green" : "red";
    const other = anchor === "red" ? "green" : "red";

    // Reference world points (full reference placement).
    const Pref = baseMapNormalizedToWorld(refTargets[anchor], refBaseMap);
    const Pother = baseMapNormalizedToWorld(refTargets[other], refBaseMap);
    if (!Pref || !Pother) return null;

    // Current world points at the current angle.
    const Cref = currentWorldAtOrigin(
      currentTargets[anchor],
      transform.angleDeg
    );
    const Cother = currentWorldAtOrigin(
      currentTargets[other],
      transform.angleDeg
    );
    if (!Cref || !Cother) return null;

    const dxR = Pother.x - Pref.x;
    const dzR = Pother.z - Pref.z;
    const dxC = Cother.x - Cref.x;
    const dzC = Cother.z - Cref.z;
    if (Math.hypot(dxR, dzR) < EPS || Math.hypot(dxC, dzC) < EPS) return null;

    // A rotation of phi around world +Y maps (x, z) to
    // (x cos phi + z sin phi, -x sin phi + z cos phi), i.e. it decreases
    // atan2(z, x) by phi. We need thetaCur - phi = thetaRef.
    const thetaRef = Math.atan2(dzR, dxR);
    const thetaCur = Math.atan2(dzC, dxC);
    const phiDeg = ((thetaCur - thetaRef) * 180) / Math.PI;
    const angleDeg = normalizeAngleDeg(transform.angleDeg + phiDeg);

    // Re-anchor the reference target with the new angle.
    const Wr = currentWorldAtOrigin(currentTargets[anchor], angleDeg);
    if (!Wr) return null;

    return {
      position: { x: Pref.x - Wr.x, y: h, z: Pref.z - Wr.z },
      angleDeg,
    };
  }

  // --- 1 cible: translation only ---
  const color = useRed ? "red" : "green";
  const Q = baseMapNormalizedToWorld(refTargets[color], refBaseMap);
  if (!Q) return null;
  const W = currentWorldAtOrigin(currentTargets[color], transform.angleDeg);
  if (!W) return null;

  return {
    position: { x: Q.x - W.x, y: h, z: Q.z - W.z },
    angleDeg: transform.angleDeg,
  };
}
