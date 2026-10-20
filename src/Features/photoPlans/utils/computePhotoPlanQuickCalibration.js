import computePhotoPlanCalibration from "./computePhotoPlanCalibration";
import { DEFAULT_FOCAL_35, focal35ToPx } from "./focal35";

// Display-only rectification of a photoPlan from the vanishing lines ALONE
// (quick-flatten flow, "Transfo." tool): no pastilles and no plan-side
// anchoring, so the metric scale and the world pose are ARBITRARY — the
// result is flagged `isUnscaled` and every metric consumer (quantities, 3D)
// must skip it. The exact placement comes later through the standard flows
// (Élévation calibration, 3D positioning).
//
// Synthesized anchors: the two endpoints of the FIRST U guide line, "1 m"
// apart in the fake world frame. Guide lines are drawn ON the plane, so this
// also picks the valid side of the plane's horizon (a fixed image point
// could sit on it — level camera — or on the wrong side — ceiling at the top
// of a photo pitched down).
//
// Focal: `focalPxOverride` (EXIF / user field) when given; otherwise, when
// the vanishing points cannot solve it (one family parallel in the photo ->
// NEEDS_FOCAL, or an inconsistent pair -> FOCAL_DEGENERATE), a default
// 26 mm-equivalent — fine for a rectified PREVIEW, flagged in
// diagnostics.warnings as DEFAULT_FOCAL.

const FOCAL_FALLBACK_ERRORS = new Set(["NEEDS_FOCAL", "FOCAL_DEGENERATE"]);

export default function computePhotoPlanQuickCalibration({
  photoImageSize,
  planeType,
  uSegments,
  vSegments,
  focalPxOverride,
  mirrored = false,
}) {
  const u1 = uSegments?.[0];
  if (!u1?.p1 || !u1?.p2) return null;

  const compute = (focalPx) =>
    computePhotoPlanCalibration({
      photoImageSize,
      planeType,
      uSegments,
      vSegments,
      photoTargets: { green: u1.p1, red: u1.p2 },
      worldTargets: { green: { x: 0, z: 0 }, red: { x: 1, z: 0 } },
      refColor: "green",
      refHeight: 0,
      focalPxOverride: focalPx,
      mirrored,
    });

  const hasOverride = Number.isFinite(focalPxOverride) && focalPxOverride > 0;
  let result = compute(hasOverride ? focalPxOverride : undefined);
  if (!hasOverride && FOCAL_FALLBACK_ERRORS.has(result?.errorCode)) {
    result = compute(focal35ToPx(DEFAULT_FOCAL_35, photoImageSize));
    if (result?.ok) result.diagnostics.warnings.push("DEFAULT_FOCAL");
  }
  if (result?.ok) result.isUnscaled = true;
  return result;
}
