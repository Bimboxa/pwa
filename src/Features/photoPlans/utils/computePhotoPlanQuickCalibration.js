import computePhotoPlanCalibration from "./computePhotoPlanCalibration";

// Display-only rectification of a photoPlan from the vanishing lines ALONE
// (quick-flatten flow, "Transfo." tool): no pastilles and no plan-side
// anchoring, so the metric scale and the world pose are ARBITRARY — the
// result is flagged `isUnscaled` and every metric consumer (quantities, 3D)
// must skip it. The exact placement comes later through the standard flows
// (Élévation calibration, 3D positioning).
//
// Level-camera facades (vertical lines parallel in the photo => NEEDS_FOCAL)
// fall back to a default 26 mm-equivalent focal — fine for a rectified
// PREVIEW, flagged in diagnostics.warnings as DEFAULT_FOCAL.

const DEFAULT_F35 = 26;

// Synthesized anchors: two horizontally-separated photo points, "1 m" apart
// in the fake world frame.
const SYNTH_INPUTS = {
  photoTargets: { green: { x: 0.3, y: 0.5 }, red: { x: 0.7, y: 0.5 } },
  worldTargets: { green: { x: 0, z: 0 }, red: { x: 1, z: 0 } },
  refColor: "green",
  refHeight: 0,
};

export default function computePhotoPlanQuickCalibration({
  photoImageSize,
  planeType,
  uSegments,
  vSegments,
}) {
  const compute = (focalPxOverride) =>
    computePhotoPlanCalibration({
      photoImageSize,
      planeType,
      uSegments,
      vSegments,
      ...SYNTH_INPUTS,
      focalPxOverride,
    });

  let result = compute(undefined);
  if (result?.errorCode === "NEEDS_FOCAL" && photoImageSize?.width) {
    result = compute((DEFAULT_F35 * photoImageSize.width) / 36);
    if (result?.ok) result.diagnostics.warnings.push("DEFAULT_FOCAL");
  }
  if (result?.ok) result.isUnscaled = true;
  return result;
}
