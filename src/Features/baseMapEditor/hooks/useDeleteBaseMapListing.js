import { useDispatch, useSelector } from "react-redux";

import {
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  setSelectedVersionId,
} from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db, { withSystemWrite } from "App/db/db";
import { canEditRecord, OwnershipError } from "App/db/ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

async function getListingBaseMapIds(listingId) {
  const baseMaps = await db.baseMaps
    .where("listingId")
    .equals(listingId)
    .toArray();
  return baseMaps.filter((bm) => !bm.deletedAt).map((bm) => bm.id);
}

/**
 * Counts what a baseMap listing deletion would take with it, to build the
 * confirmation message. Mirrors countBaseMapAnnotations (useDeleteBaseMap).
 */
export async function countBaseMapListingContent(listingId) {
  const baseMapIds = await getListingBaseMapIds(listingId);
  const annotationsCount = await db.annotations
    .where("baseMapId")
    .anyOf(baseMapIds)
    .filter((a) => !a.deletedAt)
    .count();

  return { baseMapsCount: baseMapIds.length, annotationsCount };
}

/**
 * Deletes a baseMap listing (group) with a full cascade: its baseMaps, their
 * versions, and the annotations / points drawn on them (all soft-deleted, so
 * recoverable via the purge flow).
 *
 * useDeleteListing is not usable here: its cascade stops at db[listing.table]
 * (db.baseMaps), leaving versions / annotations / points orphaned — and it
 * hard-deletes db.files, which for baseMaps holds the plan images themselves.
 * Like useDeleteBaseMap, we leave the image files in place so the soft delete
 * stays recoverable.
 */
export default function useDeleteBaseMapListing() {
  const dispatch = useDispatch();

  const currentUserId = useSelector((state) =>
    getUserIdMaster(state.auth.userProfile)
  );
  const selectedBaseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );

  return async (listing) => {
    if (!listing?.id) return;

    // ownership — block early, before any write
    if (!canEditRecord(listing, currentUserId)) throw new OwnershipError();

    const baseMapIds = await getListingBaseMapIds(listing.id);

    await db.transaction(
      "rw",
      [db.listings, db.baseMaps, db.baseMapVersions, db.annotations, db.points],
      async () => {
        await db.listings.delete(listing.id);
        // The listing owner controls its contents, so the cascade bypasses
        // child ownership (children may have been created by other users).
        await withSystemWrite(async () => {
          await db.baseMaps.where("listingId").equals(listing.id).delete();
          await db.baseMapVersions
            .where("baseMapId")
            .anyOf(baseMapIds)
            .delete();
          await db.annotations.where("baseMapId").anyOf(baseMapIds).delete();
          await db.points.where("baseMapId").anyOf(baseMapIds).delete();
        });
      }
    );

    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());

    // Clearing the displayed listing lets BaseMapTree's auto-select effect pick
    // the first remaining group.
    dispatch(setDisplayedBaseMapListingId(null));
    dispatch(setCreatingInListingId(null));
    dispatch(setSelectedVersionId(null));
    if (selectedBaseMapsListingId === listing.id) {
      dispatch(setSelectedBaseMapsListingId(null));
      dispatch(setSelectedMainBaseMapId(null));
    }
  };
}
