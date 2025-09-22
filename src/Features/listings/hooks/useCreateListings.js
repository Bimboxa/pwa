import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateRemoteListings from "Features/sync/hooks/useCreateRemoteListings";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";
import getDateString from "Features/misc/utils/getDateString";

export default function useCreateListings() {
  const { value: createdBy } = useUserEmail();
  const createdAt = getDateString(new Date());

  const createRemoteListings = useCreateRemoteListings();

  const create = async ({ listings, scope }, options) => {
    const listingsClean = listings.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
        projectId: listing?.projectId ?? scope?.projectId,
        createdBy,
        createdAt,
        updatedAt: createdAt,
      };
    });

    // create listings
    await db.listings.bulkAdd(listingsClean);

    // remote listings
    if (options?.forceLocalToRemote) {
      await createRemoteListings(listingsClean);
    }
    // update sync file
    if (options?.updateSyncFile) {
      await Promise.all(
        listingsClean.map((listing) => {
          return updateItemSyncFile({
            item: listing,
            type: "LISTING",
            updatedAt: options.updatedAt,
            syncAt: options.syncAt,
          });
        })
      );
    }

    // return

    return listingsClean;
  };

  return create;
}
