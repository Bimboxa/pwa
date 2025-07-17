import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateRemoteListings from "Features/sync/hooks/useCreateRemoteListings";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";
import getDateString from "Features/misc/utils/getDateString";

export default function useCreateListing() {
  const { value: createdBy } = useUserEmail();
  const createdAt = getDateString(new Date());

  const createRemoteListings = useCreateRemoteListings();

  const create = async ({ listing, scope }, options) => {
    const listingClean = {
      ...listing,
      id: listing?.id ?? nanoid(),
      projectId: listing?.projectId ?? scope?.projectId,
      createdBy,
      createdAt,
      updatedAt: createdAt,
    };
    // create listings
    await db.listings.add(listingClean);

    // remote listings
    if (options?.forceLocalToRemote) {
      await createRemoteListings([listingClean]);
    }
    // update sync file
    if (options?.updateSyncFile) {
      updateItemSyncFile({
        item: listingClean,
        type: "LISTING",
        updatedAt: options.updatedAt,
        syncAt: options.syncAt,
      });
    }
    // return
    return listingClean;
  };

  return create;
}
