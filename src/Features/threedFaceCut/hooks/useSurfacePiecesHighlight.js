import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  clearItemPartSelection,
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import { MESH3D_FACE_SELECTED_STIPPLE } from "Features/annotationMesh3d/constants/mesh3dPartColors";
import { buildFaceStippleOverlay } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import resolveSurfaceFaceParts from "../services/resolveSurfaceFaceParts";
import { getSelectedSurfacePieces } from "../utils/surfacePieceParts";

function disposeOverlay(overlay) {
  overlay?.parent?.remove(overlay);
  overlay?.geometry?.dispose?.();
  overlay?.material?.dispose?.();
}

// Highlights the selected faces of a surface host (selection slice parts
// SURFACE_PIECE, see surfacePieceParts) in the 3D scene: the fluo-green dots
// of a selected mesh face over the face's triangles — the hover's region of
// the piece mesh, resolved with the face selection angle — as a child of the
// piece mesh, so it follows the clipping plane, the visibility and the moves
// of the host, and goes with the host's rebuild.
//
// A selection only holds for the displayed object: when the host is rebuilt
// and no selected face is there any more (a removal, a reset, an angle
// change that moved the regions), the part selection is dropped.
export default function useSurfacePiecesHighlight({ enabled = true } = {}) {
  const dispatch = useDispatch();
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const angleDeg = useSelector((s) => s.threedEditor.faceSelectionAngleDeg);

  const pieces = getSelectedSurfacePieces(selectedItem, selectedPartIds);
  const annotationId = pieces.length ? selectedItem.nodeId : null;
  const piecesKey = pieces
    .map((part) => `${part.pieceIndex}:${part.seedTri ?? ""}`)
    .join("|");

  // Bumped when the host's 3D object is rebuilt.
  const [objectTick, setObjectTick] = useState(0);
  useEffect(() => {
    if (!enabled || !annotationId) return undefined;
    const manager = getActiveThreedEditor()?.sceneManager?.annotationsManager;
    return manager?.subscribeAnnotationReady?.((ids) => {
      if (ids.includes(annotationId)) setObjectTick((tick) => tick + 1);
    });
  }, [enabled, annotationId]);

  useEffect(() => {
    if (!enabled || !annotationId || !piecesKey) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    if (!sceneManager) return undefined;

    const faces = resolveSurfaceFaceParts({
      editor,
      annotationId,
      parts: getSelectedSurfacePieces(selectedItem, selectedPartIds),
      angleDeg,
    });
    if (!faces.length) {
      // The host was rebuilt without these faces (a removal, a reset).
      dispatch(clearItemPartSelection(annotationId));
      return undefined;
    }

    const overlays = [];
    for (const { mesh, tris } of faces) {
      const overlay = buildFaceStippleOverlay(
        mesh,
        tris,
        MESH3D_FACE_SELECTED_STIPPLE
      );
      if (!overlay) continue;
      mesh.add(overlay);
      overlays.push(overlay);
    }
    sceneManager.requestRender?.();
    return () => {
      overlays.forEach(disposeOverlay);
      sceneManager.requestRender?.();
    };
    // selectedItem / selectedPartIds are read through piecesKey.
  }, [enabled, annotationId, piecesKey, angleDeg, objectTick, dispatch]);
}
