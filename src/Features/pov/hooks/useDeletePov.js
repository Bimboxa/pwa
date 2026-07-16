import { useDispatch, useSelector } from "react-redux";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import db from "App/db/db";

// Soft-deletes a POV (middleware turns the delete into a deletedAt put). The
// db.files thumbnail row is kept: harmless, and the POV can be restored.
export default function useDeletePov() {
  const dispatch = useDispatch();
  const selectedItem = useSelector(selectSelectedItem);

  return async function deletePov(id) {
    if (!id) return;
    await db.povs.delete(id);
    if (selectedItem?.type === "POV" && selectedItem?.id === id) {
      dispatch(clearSelection());
    }
  };
}
