import {
  setMoveAnnotationModeActive,
  setVertexOffsetModeActive,
} from "Features/threedEditor/threedEditorSlice";
import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import getDisplayedMesh3d from "Features/annotationMesh3d/services/getDisplayedMesh3d";
import {
  MESH3D_FACE_PART,
  getSelectedMesh3dParts,
} from "Features/annotationMesh3d/utils/mesh3dPartIds";

// Annotations whose face vertices map one-to-one to their points: a PX
// polyline wall (one zero-thickness quad per segment, corners AT the points)
// and a plain POLYGON prism (its top / bottom rings are the points). A CM
// wall's ring corners sit half a width away from the centerline, a STRIP's
// rings are generated: no handles there.
export function isVertexOffsetSource(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  if (annotation.type === "POLYGON") return true;
  return annotation.type === "POLYLINE" && annotation.strokeWidthUnit !== "CM";
}

// The face « Déplacer » (M) would move the vertices of, read from the current
// selection: the solo-selected regular annotation with exactly ONE selected
// MESH3D_FACE part — or, without any part, whose displayed mesh is a single
// face (a 1-segment wall, a flat polygon: that lone face IS the annotation).
// Returns { annotationId, faceIndex } or null (the regular move then applies).
export default function resolveVertexOffsetTarget(state, editor) {
  const items = state.selection.selectedItems || [];
  const ids = getSelectedAnnotationIds(items);
  if (ids.length !== 1) return null;
  const annotationId = ids[0];
  const source =
    editor?.sceneManager?.annotationsManager?.getAnnotationSource?.(
      annotationId
    );
  if (!isVertexOffsetSource(source)) return null;

  const parts = getSelectedMesh3dParts(
    items[0],
    state.selection.selectedPartIds
  );
  const faces = parts.filter((part) => part.partType === MESH3D_FACE_PART);
  if (faces.length === 1) {
    return { annotationId, faceIndex: faces[0].faceIndex };
  }
  if (parts.length) return null;

  const displayed = getDisplayedMesh3d(editor, annotationId, {
    allowSingleFace: true,
  });
  if (displayed?.mesh?.faces?.length === 1) {
    return { annotationId, faceIndex: 0 };
  }
  return null;
}

// The « Déplacer » entry points (tool row, M key) share this: a selected face
// arms the vertex offset mode, anything else the regular annotation move.
// Both toggle: a second call leaves the mode.
export function activateMoveTool({ dispatch, state, editor }) {
  if (state.threedEditor.vertexOffsetMode.active) {
    dispatch(setVertexOffsetModeActive(false));
    return;
  }
  if (state.threedEditor.moveAnnotationMode.active) {
    dispatch(setMoveAnnotationModeActive(false));
    return;
  }
  const target = resolveVertexOffsetTarget(state, editor);
  if (target) dispatch(setVertexOffsetModeActive(target));
  else dispatch(setMoveAnnotationModeActive(true));
}
