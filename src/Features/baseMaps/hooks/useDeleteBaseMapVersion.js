import { useDispatch, useSelector } from "react-redux";

import { setSelectedVersionId } from "Features/baseMapEditor/baseMapEditorSlice";

import db from "App/db/db";
import activateBaseMapVersion from "../utils/activateBaseMapVersion";

/**
 * Deletes a baseMap version. If the deleted version was the active one,
 * the first remaining live version becomes active.
 */
export default function useDeleteBaseMapVersion() {
  const dispatch = useDispatch();
  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );

  return async ({ baseMapId, versionId }) => {
    const version = await db.baseMapVersions.get(versionId);
    const wasActive = Boolean(version?.isActive);

    await db.baseMapVersions.delete(versionId);

    if (wasActive) {
      const remaining = (
        await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
      )
        .filter((v) => !v.deletedAt)
        .sort((a, b) =>
          (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
        );
      if (remaining.length > 0) {
        await activateBaseMapVersion(baseMapId, remaining[0].id, dispatch);
      }
    }

    if (selectedVersionId === versionId) {
      dispatch(setSelectedVersionId(null));
    }
  };
}
