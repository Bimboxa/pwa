import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import {
  MESH3D_FACE_PART,
  getSelectedMesh3dParts,
} from "Features/annotationMesh3d/utils/mesh3dPartIds";
import { getMesh3dFaceSignature } from "Features/hiddenAnnotations/utils/mesh3dFaceSignature";

// What « Masquer l'annotation » hides right away, from the current selection:
//
//   { faces: { annotationId, signatures } }  selected face(s) of ONE mesh
//                                            annotation (stored mesh, not
//                                            carved live)
//   { annotationIds }                        the selected annotations
//   null                                     nothing to hide: the command
//                                            arms its pick mode instead
//
// A face of anything else than a stored mesh (a plain extrusion, a host
// carved by a live subtraction, a surface piece) is a triangle region of one
// solid: the whole annotation is hidden.
//
// `isCarved(annotationId)`: the mesh is displayed carved (its part indices
// then address the carved solid, not the stored faces).
//
// Pure: no hook, no store.
export default function resolveHideSelection(ctx, { isCarved } = {}) {
  const selectedItems = ctx?.selectedItems ?? [];
  const item = selectedItems[0];

  if (selectedItems.length === 1 && item) {
    const faceParts = getSelectedMesh3dParts(item, ctx.selectedPartIds).filter(
      (part) => part.partType === MESH3D_FACE_PART
    );
    const annotation = (ctx.selectedAnnotations ?? []).find(
      (a) => a.id === item.nodeId
    );
    if (
      faceParts.length > 0 &&
      annotation?.isMesh3d &&
      !isCarved?.(annotation.id)
    ) {
      const signatures = faceParts
        .map((part) => getMesh3dFaceSignature(annotation, part.faceIndex))
        .filter(Boolean);
      if (signatures.length > 0) {
        return { faces: { annotationId: annotation.id, signatures } };
      }
    }
  }

  const annotationIds = [
    ...new Set(
      getSelectedAnnotationIds(selectedItems).filter(
        (id) => !isForeignFootprintId(id)
      )
    ),
  ];
  return annotationIds.length > 0 ? { annotationIds } : null;
}
