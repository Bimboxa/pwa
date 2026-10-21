import { DUPLICATE_TYPES } from "../constants/duplicatesDetectionConstants";

// Annotations the duplicates detection compares, out of a resolved
// useAnnotationsV2 set (pixel-space points). Shared by the command's getState
// (candidates count) and the run hook, so the toolbar context (not filtered by
// base map, with footprints) and the helper's own query (main base map only)
// yield the same candidates once `baseMapId` is given.
export default function getDuplicateCandidates(
  annotations,
  { baseMapId = null, types = DUPLICATE_TYPES } = {}
) {
  return (annotations ?? []).filter((a) => {
    if (!a || !types.includes(a.type)) return false;
    const minPoints = a.type === "POLYGON" ? 3 : 2;
    if (!Array.isArray(a.points) || a.points.length < minPoints) return false;
    // « même type » = same template: templateless / orphan lines have none.
    if (!a.annotationTemplateId || a._isOrphan) return false;
    if (baseMapId && a.baseMapId !== baseMapId) return false;
    if (
      a.isBaseMapAnnotation ||
      a.isMeshCell ||
      a.isMesh3d ||
      a.isForeignFootprint ||
      a.isRevolutionFootprint
    )
      return false;
    return true;
  });
}
