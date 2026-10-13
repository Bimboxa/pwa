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

import { getSelectedSurfacePieces } from "../utils/surfacePieceParts";

function disposeOverlay(overlay) {
  overlay?.parent?.remove(overlay);
  overlay?.geometry?.dispose?.();
  overlay?.material?.dispose?.();
}

// Highlights the selected pieces of a cut surface host (selection slice
// parts SURFACE_PIECE, see surfacePieceParts) in the 3D scene: the fluo-green
// dots of a selected mesh face over each piece mesh (a child of it, so it
// follows the clipping plane, the visibility and the moves of the host, and
// goes with the host's rebuild).
//
// Piece indices only hold for the displayed object: when the host is rebuilt
// and a selected piece is not there any more, the part selection is dropped.
export default function useSurfacePiecesHighlight({ enabled = true } = {}) {
  const dispatch = useDispatch();
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);

  const pieces = getSelectedSurfacePieces(selectedItem, selectedPartIds);
  const annotationId = pieces.length ? selectedItem.nodeId : null;
  const piecesKey = pieces.map((part) => part.pieceIndex).join("|");

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
    const root =
      sceneManager?.annotationsManager?.annotationsObjectsMap?.[annotationId];
    if (!root) return undefined;

    const wanted = new Set(piecesKey.split("|").map(Number));
    const pieceMeshes = [];
    root.traverse((child) => {
      if (child.isMesh && wanted.has(child.userData?.surfaceCutPiece)) {
        pieceMeshes.push(child);
      }
    });
    if (!pieceMeshes.length) {
      // The host was rebuilt without these pieces (a removal, a reset).
      dispatch(clearItemPartSelection(annotationId));
      return undefined;
    }

    const overlays = [];
    for (const mesh of pieceMeshes) {
      const overlay = buildFaceStippleOverlay(
        mesh,
        null,
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
  }, [enabled, annotationId, piecesKey, objectTick, dispatch]);
}
