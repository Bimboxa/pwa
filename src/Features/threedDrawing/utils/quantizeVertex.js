// Quantize a 3D position to a 1 mm bucket key. Both the snap index and the
// face-detection graph use the same key so that a user-picked snap collapses
// onto the matching mesh vertex when looking up neighbors.
export const QUANTIZE_MM = 1;
const SCALE = 1000 / QUANTIZE_MM;

export default function quantizeVertex(v) {
  return `${Math.round(v.x * SCALE)}_${Math.round(v.y * SCALE)}_${Math.round(
    v.z * SCALE
  )}`;
}
