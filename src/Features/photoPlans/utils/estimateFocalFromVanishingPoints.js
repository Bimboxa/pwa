// Focal length from two ORTHOGONAL-in-the-world vanishing points, in
// CENTERED photo coords (single-view metric assumptions: square pixels,
// principal point at the image center).
//
//   f^2 = -(x1*x2 + y1*y2)   with (xi, yi) the dehomogenized VPs.
//
// Branches (vp = [x, y, w] unit homogeneous):
//   - both at infinity  -> fronto-parallel plane: f cancels downstream,
//     return a placeholder f = 1 (focalSource "frontoParallel"),
//   - one at infinity   -> f is unobservable (typical level-camera facade
//     shot: vertical edges parallel in the image) -> needs the override,
//   - f^2 <= 0          -> VPs inconsistent with orthogonality -> override
//     or error.
//
// `focalOverride` (centered units, i.e. focal_px / s) always unlocks the
// degenerate branches; when both an estimate and an override exist the
// estimate wins, with a FOCAL_MISMATCH warning when they disagree > 20%.
//
// Returns { f, source: "vps"|"override"|"frontoParallel", warnings: [] }
// or { error: "NEEDS_FOCAL"|"FOCAL_DEGENERATE" }.

const INFINITE_W = 1e-6;

export default function estimateFocalFromVanishingPoints({
  vpU,
  vpV,
  focalOverride,
}) {
  const warnings = [];
  const uInf = Math.abs(vpU[2]) < INFINITE_W;
  const vInf = Math.abs(vpV[2]) < INFINITE_W;

  if (uInf && vInf) {
    // Fronto-parallel: check the two image directions are ~perpendicular
    // (they project without distortion when the plane faces the camera).
    const cos = Math.abs(vpU[0] * vpV[0] + vpU[1] * vpV[1]);
    if (cos > Math.sin((5 * Math.PI) / 180)) {
      warnings.push("FRONTO_NOT_ORTHO");
    }
    return { f: 1, source: "frontoParallel", warnings };
  }

  if (uInf || vInf) {
    if (Number.isFinite(focalOverride) && focalOverride > 0) {
      return { f: focalOverride, source: "override", warnings };
    }
    return { error: "NEEDS_FOCAL" };
  }

  const x1 = vpU[0] / vpU[2];
  const y1 = vpU[1] / vpU[2];
  const x2 = vpV[0] / vpV[2];
  const y2 = vpV[1] / vpV[2];
  const f2 = -(x1 * x2 + y1 * y2);

  if (!(f2 > 1e-9)) {
    if (Number.isFinite(focalOverride) && focalOverride > 0) {
      return { f: focalOverride, source: "override", warnings };
    }
    return { error: "FOCAL_DEGENERATE" };
  }

  const f = Math.sqrt(f2);
  if (Number.isFinite(focalOverride) && focalOverride > 0) {
    const ratio = Math.max(f / focalOverride, focalOverride / f);
    if (ratio > 1.2) warnings.push("FOCAL_MISMATCH");
  }
  return { f, source: "vps", warnings };
}
