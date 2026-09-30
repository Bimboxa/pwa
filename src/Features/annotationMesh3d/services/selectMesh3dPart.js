import {
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";

import { isMesh3dPartId } from "../utils/mesh3dPartIds";

const getPartType = (partId) => (partId ? partId.split("::")[1] : null);

// Selects a face / edge of the currently selected mesh annotation, as a
// sub-selection of that annotation (selection slice parts, like the 2D
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
  ).filter(isMesh3dPartId);
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
