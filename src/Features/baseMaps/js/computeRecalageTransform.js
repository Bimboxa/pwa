import getBaseMapTransform from "./getBaseMapTransform";
import baseMapNormalizedToWorld from "./baseMapNormalizedToWorld";

// Recompute a baseMap's placement in the main 3D referential so that its
// calibration targets coincide with the corresponding targets on a reference
// baseMap.
//
// Behaviour (no rotation — `angleDeg` is read but never changed; `position.y`
// height is kept):
//   - 1 cible  -> translation only (position.x/z); meterByPx unchanged.
//   - 2 cibles -> translation + scale (no rotation). Scale = ratio of the
//     world distances between the two target pairs, applied to `meterByPx`.
//
// Targets are relative {x, y} in [0..1] (same space as `db.points`).
//
// Returns `{ position: {x, y, z}, meterByPx }` or `null` when the inputs are
// insufficient (no usable target, missing sizes/meterByPx, degenerate scale).
export default function computeRecalageTransform({
  currentBaseMap,
  refBaseMap,
  currentTargets,
  refTargets,
  useRed,
  useGreen,
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
  // a chosen meterByPx and the placement pinned at {x:0, z:0} (height kept).
  const transformAtOrigin = { ...transform, position: { x: 0, y: h, z: 0 } };
  const currentWorldAtOrigin = (rel, mbp) =>
    baseMapNormalizedToWorld(rel, currentBaseMap, {
      meterByPx: mbp,
      transform: transformAtOrigin,
    });

  // Reference world points (full reference placement).
  const Qred = useRed
    ? baseMapNormalizedToWorld(refTargets.red, refBaseMap)
    : null;
  const Qgreen = useGreen
    ? baseMapNormalizedToWorld(refTargets.green, refBaseMap)
    : null;

  // --- 2 cibles: translation + scale (no rotation) ---
  if (useRed && useGreen) {
    if (!Qred || !Qgreen) return null;

    // Current target world points at the *current* meterByPx (XZ plane).
    const Cred = currentWorldAtOrigin(currentTargets.red, meterByPx);
    const Cgreen = currentWorldAtOrigin(currentTargets.green, meterByPx);
    if (!Cred || !Cgreen) return null;

    const dRef = Math.hypot(Qgreen.x - Qred.x, Qgreen.z - Qred.z);
    const dCur = Math.hypot(Cgreen.x - Cred.x, Cgreen.z - Cred.z);
    if (dRef === 0 || dCur === 0) return null;

    const scale = dRef / dCur;
    const newMeterByPx = meterByPx * scale;

    // Re-anchor red after scaling.
    const Wr = currentWorldAtOrigin(currentTargets.red, newMeterByPx);
    if (!Wr) return null;

    return {
      position: { x: Qred.x - Wr.x, y: h, z: Qred.z - Wr.z },
      meterByPx: newMeterByPx,
    };
  }

  // --- 1 cible: translation only ---
  const color = useRed ? "red" : "green";
  const Q = useRed ? Qred : Qgreen;
  if (!Q) return null;
  const W = currentWorldAtOrigin(currentTargets[color], meterByPx);
  if (!W) return null;

  return {
    position: { x: Q.x - W.x, y: h, z: Q.z - W.z },
    meterByPx,
  };
}
