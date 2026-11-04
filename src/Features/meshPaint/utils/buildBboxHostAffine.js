// Pixel affine of a bbox-based host transform (OBJECT_3D: move + rotate,
// no resize) — what applyAffineToPaintGeometry needs to carry the host's
// painted parts along, since such a host has no db.points for
// commitWrapperTransform to fit an affine on.
//
// Affine form {a, b, c, d, e, f}: x' = a·x + b·y + c, y' = d·x + e·y + f, in
// image PIXELS (fitAffine2d's convention).
//
// Pure: node-testable.

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Translation of the host by a pixel delta.
 *
 * @param {{x: number, y: number}} delta
 */
export function bboxHostMoveAffine(delta) {
  return {
    a: 1,
    b: 0,
    c: Number(delta?.x) || 0,
    d: 0,
    e: 1,
    f: Number(delta?.y) || 0,
  };
}

/**
 * Rotation of the host by `deltaDeg` about `center` (pixels), with the
 * 2D editor's convention (applyWrapperTransformToPoints ROTATE: positive =
 * clockwise on screen since image y points down):
 *   x' = cx + dx·cos − dy·sin,  y' = cy + dx·sin + dy·cos.
 *
 * @param {{deltaDeg: number, center: {x: number, y: number}}} args
 */
export function bboxHostRotationAffine({ deltaDeg, center }) {
  const angle = toRad(Number(deltaDeg) || 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = Number(center?.x) || 0;
  const cy = Number(center?.y) || 0;
  return {
    a: cos,
    b: -sin,
    c: cx - cx * cos + cy * sin,
    d: sin,
    e: cos,
    f: cy - cx * sin - cy * cos,
  };
}

/**
 * Pixel center of a bbox (the OBJECT_3D rotation pivot, see
 * createObject3DAnnotation's bboxCenterPx).
 *
 * @param {{x: number, y: number, width: number, height: number}} bbox - pixels
 */
export function bboxCenterPx(bbox) {
  return {
    x: (Number(bbox?.x) || 0) + (Number(bbox?.width) || 0) / 2,
    y: (Number(bbox?.y) || 0) + (Number(bbox?.height) || 0) / 2,
  };
}
