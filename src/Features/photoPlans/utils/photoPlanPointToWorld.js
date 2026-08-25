import applyPhotoPlanHomography from "./applyPhotoPlanHomography";

// Reconstruct the world position of a NORMALIZED photo point through a
// calibrated photoPlan: (u, v) = H . point, then
//   world = origin + u * uDir + v * vDir.
//
// `calibration` is the photoPlan.calibration blob ({H, pose}). Returns
// {x, y, z} or null (uncalibrated / point beyond the horizon).
export default function photoPlanPointToWorld(calibration, point) {
  if (!calibration?.ok || !calibration.H || !calibration.pose) return null;
  const uv = applyPhotoPlanHomography(calibration.H, point);
  if (!uv) return null;
  const { origin, uDir, vDir } = calibration.pose;
  return {
    x: origin.x + uv.x * uDir.x + uv.y * vDir.x,
    y: origin.y + uv.x * uDir.y + uv.y * vDir.y,
    z: origin.z + uv.x * uDir.z + uv.y * vDir.z,
  };
}
