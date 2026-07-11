import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db, { withSystemWrite } from "App/db/db";

/**
 * Moves a baseMap to another baseMap group (listing) and cascades the new
 * listingId to its versions, files, and to the annotations/points that were
 * stamped with the source group's listingId.
 *
 * Annotations drawn from other viewers carry an annotations-listing id that
 * drives scope filtering: those rows keep their listingId untouched — they
 * follow the baseMap through baseMapId only.
 */
export default function useMoveBaseMapToListing() {
  const dispatch = useDispatch();

  return async ({
    baseMapId,
    sourceListingId,
    targetListingId,
    newSortIndex,
  }) => {
    await db.transaction(
      "rw",
      [db.baseMaps, db.baseMapVersions, db.files, db.annotations, db.points],
      async () => {
        await db.baseMaps.update(baseMapId, {
          listingId: targetListingId,
          sortIndex: newSortIndex,
        });

        // Parent-authorized cascade.
        await withSystemWrite(async () => {
          const versions = await db.baseMapVersions
            .where("baseMapId")
            .equals(baseMapId)
            .toArray();
          await db.baseMapVersions
            .where("baseMapId")
            .equals(baseMapId)
            .modify({ listingId: targetListingId });

          // Files: baseMap-level files + version image files (files are
          // keyed by fileName and carry no baseMapId).
          await db.files
            .where("entityId")
            .equals(baseMapId)
            .modify({ listingId: targetListingId });
          const versionFileNames = versions
            .map((v) => v.image?.fileName)
            .filter(Boolean);
          if (versionFileNames.length > 0) {
            await db.files
              .where("fileName")
              .anyOf(versionFileNames)
              .modify({ listingId: targetListingId });
          }

          await db.annotations
            .where("baseMapId")
            .equals(baseMapId)
            .modify((a) => {
              if (a.listingId === sourceListingId) {
                a.listingId = targetListingId;
              }
            });
          await db.points
            .where("baseMapId")
            .equals(baseMapId)
            .modify((p) => {
              if (p.listingId === sourceListingId) {
                p.listingId = targetListingId;
              }
            });
        });
      }
    );

    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
  };
}
