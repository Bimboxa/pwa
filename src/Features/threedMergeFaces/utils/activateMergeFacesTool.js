import { setMergeFacesModeActive } from "Features/threedEditor/threedEditorSlice";
import {
  getFaceCutLockedPart,
  resolveAnnotationFace,
} from "Features/threedFaceCut/utils/resolveFaceCutLockedFace";

// Seed of the « Fusionner des faces » mode read from a resolved face: the
// annotation + the face plane in the base map local frame (absolute z).
export function buildMergeFacesSeed(face) {
  if (!face?.planeLocal) return null;
  const { point, normal } = face.planeLocal;
  return {
    annotationId: face.annotationId,
    baseMapId: face.baseMapId ?? null,
    plane: {
      point: [point.x, point.y, point.z],
      normal: [normal.x, normal.y, normal.z],
    },
  };
}

// Arms « Fusionner des faces » from the overlay button / the tools list:
// with exactly one selected face (getFaceCutLockedPart) that face is the
// seed; otherwise the mode arms without a seed and the first clicked face
// becomes it. Toggles the mode off when already armed (tools list row).
export default function activateMergeFacesTool({ dispatch, state, editor }) {
  if (state.threedEditor.mergeFacesMode.active) {
    dispatch(setMergeFacesModeActive(false));
    return;
  }
  const part = getFaceCutLockedPart(state);
  const face = part ? resolveAnnotationFace(editor, part) : null;
  const seed = buildMergeFacesSeed(face);
  dispatch(setMergeFacesModeActive(seed ? { seed } : true));
}
