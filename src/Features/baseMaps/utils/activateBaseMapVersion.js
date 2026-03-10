import db from "App/db/db";
import store from "App/store";
import {
  setHiddenVersionIds,
  setSelectedVersionId,
} from "Features/baseMapEditor/baseMapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

export default async function activateBaseMapVersion(
  baseMapId,
  versionId,
  dispatch
) {
  const allVersions = await db.baseMapVersions
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();

  const liveVersions = allVersions.filter((v) => !v.deletedAt);

  await Promise.all(
    liveVersions
      .filter((v) => v.isActive)
      .map((v) => db.baseMapVersions.update(v.id, { isActive: false }))
  );

  if (versionId) {
    await db.baseMapVersions.update(versionId, { isActive: true });
  }

  // Reset visibility: hide all versions except the newly active one
  if (dispatch) {
    const hiddenIds = liveVersions
      .filter((v) => v.id !== versionId)
      .map((v) => v.id);
    dispatch(setHiddenVersionIds(hiddenIds));

    // If a version is currently selected, update selection to the newly activated version
    if (versionId) {
      const selectedItem = store.getState().selection.selectedItems[0];
      if (selectedItem?.type === "BASE_MAP_VERSION") {
        dispatch(setSelectedVersionId(versionId));
        dispatch(
          setSelectedItem({
            id: versionId,
            type: "BASE_MAP_VERSION",
            listingId: selectedItem.listingId,
            baseMapId,
          })
        );
      }
    }
  }
}
