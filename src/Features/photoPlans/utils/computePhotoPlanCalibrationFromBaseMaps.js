import baseMapNormalizedToWorld from "Features/baseMaps/js/baseMapNormalizedToWorld";

import computePhotoPlanCalibration from "./computePhotoPlanCalibration";

// Thin wrapper around computePhotoPlanCalibration, mirroring the
// computeVerticalBaseMapPlacement signature: resolves the plan-side pastilles
// to world XZ through the plan baseMap's placement, and reads the photo's
// reference imageSize.
//
// Returns null on missing baseMaps / sizes (nothing to diagnose), else the
// full computePhotoPlanCalibration result ({ ok, errorCode?, ... }).
export default function computePhotoPlanCalibrationFromBaseMaps({
  photoBaseMap,
  photoPlan,
  planBaseMap,
  planTargets, // normalized {red, green} on the plan baseMap
  photoTargets, // normalized {red, green} on the photo
  uSegments,
  vSegments,
  refColor,
  refHeight,
  focalPxOverride,
  knownCote,
}) {
  if (!photoBaseMap || !planBaseMap || !photoPlan) return null;
  if (!planTargets?.red || !planTargets?.green) return null;

  const imageSize =
    typeof photoBaseMap.getImageSize === "function"
      ? photoBaseMap.getImageSize()
      : photoBaseMap.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const red = baseMapNormalizedToWorld(planTargets.red, planBaseMap);
  const green = baseMapNormalizedToWorld(planTargets.green, planBaseMap);
  if (!red || !green) return null;

  return computePhotoPlanCalibration({
    photoImageSize: imageSize,
    planeType: photoPlan.orientation,
    uSegments,
    vSegments,
    photoTargets,
    worldTargets: {
      red: { x: red.x, z: red.z },
      green: { x: green.x, z: green.z },
    },
    refColor,
    refHeight,
    focalPxOverride,
    knownCote,
  });
}
