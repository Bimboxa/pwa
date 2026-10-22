import { useMemo } from "react";

import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { getSelectedSurfacePieces } from "../utils/surfacePieceParts";

// Area (m²) of the given pieces of a surface host, read from the displayed
// piece meshes (userData.surfaceCutPieceSurface, applySurfaceCuts); null
// when none of them is displayed.
export function getSurfacePiecesSurfaceM2(annotationId, pieceIndices) {
  const root =
    getActiveThreedEditor()?.sceneManager?.annotationsManager
      ?.annotationsObjectsMap?.[annotationId];
  if (!root) return null;
  const wanted = new Set(pieceIndices);
  let total = 0;
  let found = false;
  root.traverse((mesh) => {
    if (!mesh.isMesh || !wanted.has(mesh.userData?.surfaceCutPiece)) return;
    if (Number.isFinite(mesh.userData.surfaceCutPieceSurface)) {
      total += mesh.userData.surfaceCutPieceSurface;
      found = true;
    }
  });
  return found ? total : null;
}

// The pieces of a surface host (lathe, shell, swept profile) currently
// selected (selection slice parts SURFACE_PIECE, surfacePieceParts):
//
//   { annotationId, pieces, pieceIndices, surface }
//
// `surface` (m²) is read from the displayed meshes at render time; null when
// the pieces are not displayed (the host is being rebuilt).
export default function useSelectedSurfacePieces() {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);

  const pieces = useMemo(
    () => getSelectedSurfacePieces(selectedItem, selectedPartIds),
    [selectedItem, selectedPartIds]
  );
  const annotationId = pieces.length ? selectedItem.nodeId : null;
  const pieceIndices = useMemo(
    () => pieces.map((part) => part.pieceIndex),
    [pieces]
  );
  const surface = annotationId
    ? getSurfacePiecesSurfaceM2(annotationId, pieceIndices)
    : null;

  return { annotationId, pieces, pieceIndices, surface };
}
