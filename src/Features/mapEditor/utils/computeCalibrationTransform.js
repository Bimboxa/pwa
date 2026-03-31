const DEFAULT_RED = { x: 0.1, y: 0.1 };
const DEFAULT_GREEN = { x: 0.9, y: 0.9 };

export { DEFAULT_RED, DEFAULT_GREEN };

/**
 * Compute the translation + scale transform to align the active version
 * onto the reference version, based on two pairs of calibration targets.
 *
 * @param {Object} params
 * @param {Object} params.activeTargets  { red: {x,y}, green: {x,y} } relative (0..1)
 * @param {Object} params.refTargets     { red: {x,y}, green: {x,y} } relative (0..1)
 * @param {Object} params.refSize        { width, height } in px (reference coord space)
 * @param {Object} params.activeTransform { x, y, scale, rotation } current transform
 * @returns {{ x, y, scale, rotation: 0 } | null}
 */
export default function computeCalibrationTransform({
  activeTargets,
  refTargets,
  refSize,
  activeTransform,
}) {
  const { width: refW, height: refH } = refSize;

  // Target positions in reference space (where they're rendered)
  const refRedPos = { x: refTargets.red.x * refW, y: refTargets.red.y * refH };
  const refGreenPos = {
    x: refTargets.green.x * refW,
    y: refTargets.green.y * refH,
  };
  const actRedPos = {
    x: activeTargets.red.x * refW,
    y: activeTargets.red.y * refH,
  };
  const actGreenPos = {
    x: activeTargets.green.x * refW,
    y: activeTargets.green.y * refH,
  };

  // Convert active target positions to image-LOCAL coords (undo current transform)
  const aT = activeTransform;
  const actRedLocal = {
    x: (actRedPos.x - aT.x) / aT.scale,
    y: (actRedPos.y - aT.y) / aT.scale,
  };
  const actGreenLocal = {
    x: (actGreenPos.x - aT.x) / aT.scale,
    y: (actGreenPos.y - aT.y) / aT.scale,
  };

  // Scale from distances
  const dRef = Math.hypot(
    refGreenPos.x - refRedPos.x,
    refGreenPos.y - refRedPos.y
  );
  const dLocal = Math.hypot(
    actGreenLocal.x - actRedLocal.x,
    actGreenLocal.y - actRedLocal.y
  );

  if (dLocal === 0 || dRef === 0) return null;

  const scale = dRef / dLocal;

  // Translation: map red image-local point to ref red position
  const x = refRedPos.x - scale * actRedLocal.x;
  const y = refRedPos.y - scale * actRedLocal.y;

  return { x, y, scale, rotation: 0 };
}
