import { DUPLICATE_TYPES } from "../constants/duplicatesDetectionConstants";

// Generated / foreign annotations never enter the detection, whatever is
// compared (annotations between them, or the cuts of one polygon).
export function isExcludedFromDetection(a, { baseMapId = null } = {}) {
  if (baseMapId && a.baseMapId !== baseMapId) return true;
  // generated elements of a system instance (treads, posts, ...) overlap by
  // construction and are rebuilt by useSystemsSync: only the source counts.
  if (a.systemSourceAnnotationId) return true;
  return Boolean(
    a.isBaseMapAnnotation ||
    a.isMeshCell ||
    a.isMesh3d ||
    a.isForeignFootprint ||
    a.isRevolutionFootprint
  );
}

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
    return !isExcludedFromDetection(a, { baseMapId });
  });
}
