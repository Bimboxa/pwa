// Maps a partial-revolution angular range, defined in the plan LOCAL METRE
// frame (y UP, CCW from the plan base map's local +X), to
// THREE.LatheGeometry's { phiStart, phiLength }.
//
// DERIVATION
// LatheGeometry revolves the (radius, height) profile around local +Y with
//   vertex = (r·sin φ, height, r·cos φ)      (φ from +Z toward +X)
// On a VERTICAL base map buildRevolutionMesh applies no rotation, so a lathe
// point at φ sits at the world offset  r·sin φ·u + r·cos φ·n  from the axis,
// where u is the base map's local +X and n its normal. The placement solver
// aligns u with the axis diameter direction θ (see
// computeVerticalBaseMapPlacementFromAxis), and n is then the −orange side, so
// in the plan local frame u = (cos θ, sin θ) and n = (sin θ, −cos θ). Hence
//   X = r[sin φ·cos θ + cos φ·sin θ] =  r·sin(φ + θ)
//   Y = r[sin φ·sin θ − cos φ·cos θ] = −r·cos(φ + θ)
// so the plan angle of that point is ψ = φ + θ − π/2, i.e.
//
//     φ = ψ − θ + π/2
//
// Cross-checks: φ = 0 puts the material along +n (the image-facing side) and
// φ = π along −n (the ORANGE half) — which is exactly what the camera-side
// half-view branch in createAnnotationObject3D hard-codes as
// phiStart = ±π/2, phiLength = π. Two independent derivations agree.
//
// NOTE: the previous version of this file used a fixed `SIGN = -1, OFFSET =
// π/2`, i.e. it silently assumed θ = 0. Nothing enforced that — the elevation's
// angleDeg came from an unrelated 2-target calibration — which is why the
// mapping could never be calibrated. The −θ term is the fix.
const TWO_PI = Math.PI * 2;

function normalizeSpan(span) {
  let s = span % TWO_PI;
  if (s <= 0) s += TWO_PI;
  return s;
}

/**
 * @param {number} angleStart  plan angle (rad, local metre frame) — start of the KEPT material
 * @param {number} angleEnd    plan angle (rad, local metre frame) — end of the KEPT material
 * @param {number} [axisDirectionRad] effective diameter direction θ of the axis
 * @returns {{phiStart:number, phiLength:number}}
 */
export default function getRevolutionPhi(
  angleStart,
  angleEnd,
  axisDirectionRad = 0
) {
  const span = normalizeSpan(angleEnd - angleStart);
  // ψ and φ differ by a constant only, so they share orientation: no swap.
  const phiStart = angleStart - axisDirectionRad + Math.PI / 2;
  return { phiStart, phiLength: span };
}

export { normalizeSpan };
