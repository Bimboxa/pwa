import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import isOpeningAnnotation from "Features/annotations/utils/isOpeningAnnotation";
import { isTransformable2dType } from "Features/annotationTransform/utils/transform2dTypes";

// Annotations of a selection the align commands can move: the types the 2D
// « Déplacer » write handles (commitAnnotationsTransform2d), on the main base
// map. Left in place:
//   - isMesh3d meshes (their 2D polygon is the projection of a 3D mesh);
//   - openings (they slide along their host wall);
//   - read-only footprints (foreign:: / revolution::);
//   - annotations of another base map (one image frame per commit);
//   - POINT annotations (no measurable bbox to align).
// `canEdit(annotation)` (optional) drops the annotations the user cannot edit.
export default function getAlignTargets({ annotations, baseMapId, canEdit }) {
  if (!baseMapId) return [];
  return (annotations ?? []).filter(
    (a) =>
      a &&
      a.baseMapId === baseMapId &&
      isTransformable2dType("MOVE", a.type) &&
      a.type !== "POINT" &&
      !a.isMesh3d &&
      !a.isForeignFootprint &&
      !isForeignFootprintId(a.id) &&
      !isOpeningAnnotation(a) &&
      (!canEdit || canEdit(a))
  );
}
