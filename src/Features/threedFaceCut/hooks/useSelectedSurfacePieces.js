import { useMemo } from "react";

import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import resolveSurfaceFaceParts from "../services/resolveSurfaceFaceParts";
import { getSelectedSurfacePieces } from "../utils/surfacePieceParts";

// The faces of a surface host (lathe, shell, swept profile) currently
// selected (selection slice parts SURFACE_PIECE, surfacePieceParts),
// resolved against the displayed object (resolveSurfaceFaceParts):
//
//   { annotationId, pieces, faces, surface, canDelete, pieceIndices }
//
// `faces` are the resolved faces (region, m²); `surface` their total (real,
// half-view factor applied) or null when none is displayed (the host is
// being rebuilt); `canDelete` when every selected face covers its whole
// piece (a REMOVE entry of surfaceCuts drops a piece, never a part of it);
// `pieceIndices` the pieces to drop then.
export default function useSelectedSurfacePieces() {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const angleDeg = useSelector((s) => s.threedEditor.faceSelectionAngleDeg);

  const pieces = useMemo(
    () => getSelectedSurfacePieces(selectedItem, selectedPartIds),
    [selectedItem, selectedPartIds]
  );
  const annotationId = pieces.length ? selectedItem.nodeId : null;
  // Read at render time: the scene is no React state (a rebuild clears the
  // selection through useSurfacePiecesHighlight, which re-renders us).
  const faces = annotationId
    ? resolveSurfaceFaceParts({
        editor: getActiveThreedEditor(),
        annotationId,
        parts: pieces,
        angleDeg,
      })
    : [];
  const surface = faces.length
    ? faces.reduce((sum, face) => sum + face.surface, 0)
    : null;
  const canDelete =
    faces.length > 0 &&
    faces.length === pieces.length &&
    faces.every((face) => face.isWholePiece);
  const pieceIndices = useMemo(
    () => [...new Set(pieces.map((part) => part.pieceIndex))],
    [pieces]
  );

  return { annotationId, pieces, faces, surface, canDelete, pieceIndices };
}
