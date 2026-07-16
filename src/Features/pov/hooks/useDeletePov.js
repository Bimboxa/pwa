import { useDispatch, useSelector } from "react-redux";

import {
  clearSelection,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import db, { withHardDelete } from "App/db/db";

// Hard-deletes a POV (withHardDelete bypasses the soft-delete middleware —
// no deletedAt tombstone) along with its db.files rows (capture thumbnail +
// saved AI-transformed image).
export default function useDeletePov() {
  const dispatch = useDispatch();
  const selectedItem = useSelector(selectSelectedItem);

  return async function deletePov(id) {
    if (!id) return;

    const pov = await db.povs.get(id);

    await withHardDelete(async () => {
      const fileNames = [
        pov?.image?.fileName,
        pov?.transformedImage?.fileName,
      ].filter(Boolean);
      if (fileNames.length > 0) await db.files.bulkDelete(fileNames);
      await db.povs.delete(id);
    });

    if (selectedItem?.type === "POV" && selectedItem?.id === id) {
      dispatch(clearSelection());
    }
  };
}
