// Maps a partial-revolution angular range, defined in the 2D plan (image-pixel
// frame, y down), to THREE.LatheGeometry's { phiStart, phiLength }.
//
// LatheGeometry revolves the (radius, height) profile around local +Y with
//   vertex = (r·sin(phi), height, r·cos(phi))   (phi from +Z toward +X).
// For a HORIZONTAL base map buildRevolutionMesh then does rotateX(+90°), which
// stands the solid up along +Z and maps the in-plane point at angle phi to plan
// coords (px, py) = (r·sin(phi), -r·cos(phi)) → plan angle θ = atan2(py, px)
// = phi - π/2 (math frame). Because the pixel y axis points DOWN, the on-screen
// plan angle is negated, giving phi = -θ_pixel + π/2 for a HORIZONTAL map.
//
// SIGN / OFFSET are kept as named constants so the mapping can be calibrated
// once empirically against the 3D viewer without touching call sites.
const TWO_PI = Math.PI * 2;

const SIGN = -1; // pixel-y-down → math frame
const OFFSET = Math.PI / 2; // lathe phi=0 sits at plan angle -π/2

function planAngleToPhi(theta) {
  return SIGN * theta + OFFSET;
}

function normalizeSpan(span) {
  let s = span % TWO_PI;
  if (s <= 0) s += TWO_PI;
  return s;
}

/**
 * @param {number} angleStart plan angle (rad), start of the KEPT material
 * @param {number} angleEnd   plan angle (rad), end of the KEPT material
 * @returns {{phiStart:number, phiLength:number}}
 */
export default function getRevolutionPhi(angleStart, angleEnd) {
  const span = normalizeSpan(angleEnd - angleStart); // kept span, plan frame
  const phiA = planAngleToPhi(angleStart);
  const phiB = planAngleToPhi(angleEnd);
  // SIGN < 0 reverses orientation: the material that runs start→end (increasing
  // plan angle) runs end→start in lathe space, so begin at phiB.
  const phiStart = SIGN < 0 ? phiB : phiA;
  return { phiStart, phiLength: span };
}

export { planAngleToPhi, normalizeSpan };
