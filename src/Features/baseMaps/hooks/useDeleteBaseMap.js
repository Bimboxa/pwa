import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db, { withSystemWrite } from "App/db/db";
import collectBaseMapLinkCloneIds from "Features/baseMapLinks/services/collectBaseMapLinkCloneIds";

export async function countBaseMapAnnotations(baseMapId) {
  return db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .filter((a) => !a.deletedAt)
    .count();
}

/**
 * Deletes a baseMap with a full cascade: versions, annotations and points
 * drawn on it (all soft-deleted, so recoverable via the purge flow).
 */
export default function useDeleteBaseMap() {
  const dispatch = useDispatch();

  return async (baseMap) => {
    // BASE_MAP_LINK marks hosted by this base map: their clones (drawn on
    // other base maps) die with their source.
    const hostedLinks = await db.annotations
      .where("baseMapId")
      .equals(baseMap.id)
      .filter((a) => !a.deletedAt && a.type === "BASE_MAP_LINK")
      .toArray();
    const cloneIds = await collectBaseMapLinkCloneIds(
      hostedLinks.map((a) => a.id)
    );

    await db.transaction(
      "rw",
      [db.baseMaps, db.baseMapVersions, db.annotations, db.points],
      async () => {
        await db.baseMaps.delete(baseMap.id);
        await withSystemWrite(async () => {
          await db.baseMapVersions
            .where("baseMapId")
            .equals(baseMap.id)
            .delete();
          await db.annotations.where("baseMapId").equals(baseMap.id).delete();
          await db.points.where("baseMapId").equals(baseMap.id).delete();
          // DETAIL annotations living on OTHER baseMaps may link this one
          // (detailBaseMapId): unlink them to avoid dangling references.
          await db.annotations
            .filter((a) => a.detailBaseMapId === baseMap.id)
            .modify({ detailBaseMapId: null });
          // Same for BASE_MAP_LINK marks targeting this base map.
          await db.annotations
            .filter((a) => a.linkedBaseMapId === baseMap.id)
            .modify({ linkedBaseMapId: null });
          if (cloneIds.length > 0) {
            await db.annotations.where("id").anyOf(cloneIds).delete();
          }
        });
      }
    );

    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
  };
}
