import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db, { withSystemWrite } from "App/db/db";

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
        });
      }
    );

    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
  };
}
