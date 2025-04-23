import db from "App/db/db";
import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateListings(options) {
  const createdBy = useUserEmail();
  const createdAt = getDateString(new Date());

  const create = async ({listings, scope}) => {
    const listingsClean = listings.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
        projectId: listing?.projectId ?? scope?.projectId,
        createdBy,
        createdAt,
      };
    });

    // create listings
    await db.listings.bulkAdd(listingsClean);

    // update sync file
    await Promise.all(
      listingsClean.map((listing) => {
        return updateItemSyncFile(
          {
            item: listing,
            type: "LISTING",
          },
          {updateSyncFile: options?.updateSyncFile}
        );
      })
    );
  };

  return create;
}
