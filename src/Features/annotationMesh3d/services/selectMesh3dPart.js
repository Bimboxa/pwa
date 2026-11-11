import {
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";

import { isSurfacePiecePartId } from "Features/threedFaceCut/utils/surfacePieceParts";

import {
  MESH3D_FACE_PART,
  getMesh3dEdgePartId,
  getMesh3dFacePartId,
  getMesh3dPartId,
  isMesh3dPartId,
} from "../utils/mesh3dPartIds";

const getPartType = (partId) => (partId ? partId.split("::")[1] : null);

// Selects a face / edge of the currently selected mesh annotation (or a piece
// of a cut surface host, surfacePieceParts), as a sub-selection of that
// annotation (selection slice parts, like the 2D
// segments): a single part sits in selectedItems[0].partId, several in
// selectedPartIds with one of them as the representative.
//
// additive (shift+click): toggles the part in the multi selection.
export default function selectMesh3dPart({
  dispatch,
  getState,
  partId,
  additive = false,
}) {
  if (!additive) {
    dispatch(setSelectedPartIds([]));
    dispatch(setSubSelection({ partId, partType: getPartType(partId) }));
    return;
  }

  const { selectedItems, selectedPartIds } = getState().selection;
  const single = selectedItems[0]?.partId;
  const current = (
    selectedPartIds.length ? selectedPartIds : single ? [single] : []
  ).filter((id) => isMesh3dPartId(id) || isSurfacePiecePartId(id));
  const next = current.includes(partId)
    ? current.filter((id) => id !== partId)
    : [...current, partId];
  const representative = next.includes(partId) ? partId : (next[0] ?? null);

  dispatch(setSelectedPartIds(next.length > 1 ? next : []));
  dispatch(
    setSubSelection({
      partId: representative,
      partType: getPartType(representative),
    })
  );
}

// Selects the whole connected block of a face (double-click on a face): all
// its faces and all their edges (getMesh3dComponentParts). The clicked face
// is the representative part, the others join it in the multi selection.
// Shift+click then removes / adds any of them (selectMesh3dPart, additive).
//
// faceIndices / edges: the block's faces and its edges as vertex pairs.
export function selectMesh3dComponent({
  dispatch,
  annotationId,
  faceIndex,
  faceIndices,
  edges,
}) {
  const faceId = getMesh3dFacePartId(annotationId, faceIndex);
  const partIds = [
    ...new Set([
      faceId,
      ...(faceIndices || []).map((index) =>
        getMesh3dFacePartId(annotationId, index)
      ),
      ...(edges || []).map(([a, b]) => getMesh3dEdgePartId(annotationId, a, b)),
    ]),
  ];
  dispatch(setSelectedPartIds(partIds));
  dispatch(setSubSelection({ partId: faceId, partType: MESH3D_FACE_PART }));
}

// Drops every selected part of one type (the cross of the « Faces » /
// « Arêtes » section of the selection toolbar): the parts of the other type
// stay selected; nothing left returns to the whole annotation.
//
// parts: the parsed selected parts (getSelectedMesh3dParts).
export function removeMesh3dPartsOfType({ dispatch, parts, partType }) {
  const kept = (parts || [])
    .filter((part) => part.partType !== partType)
    .map(getMesh3dPartId);
  const representative = kept[0] ?? null;
  dispatch(setSelectedPartIds(kept.length > 1 ? kept : []));
  dispatch(
    setSubSelection({
      partId: representative,
      partType: getPartType(representative),
    })
  );
}
