import db from "App/db/db";
import { setHiddenVersionIds } from "Features/baseMapEditor/baseMapEditorSlice";

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
  }
}
