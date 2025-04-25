import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateListings from "Features/listings/hooks/useCreateListings";

import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateScope() {
  const {value: createdBy} = useUserEmail();
  const createdAt = new Date(Date.now()).toISOString();

  const createListings = useCreateListings();

  const create = async (
    {id, name, clientRef, projectId, newListings, sortedListings},
    options
  ) => {
    // options

    const updateSyncFile = options?.updateSyncFile;

    //
    const listingsWithIds = newListings?.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
      };
    });
    //
    sortedListings =
      sortedListings ??
      listingsWithIds?.map((listing) => ({
        id: listing.id,
        table: listing.table,
      }));
    //
    const scope = {
      id: id ?? nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
      projectId,
      sortedListings,
    };
    await db.scopes.add(scope);
    console.log("debug_25_04 [db] added scope", scope);

    // update sync file
    if (updateSyncFile) {
      await updateItemSyncFile({
        item: scope,
        type: "SCOPE",
        updatedAt: options.updatedAt,
        syncAt: options.syncAt,
      });
    }

    // add listings
    if (newListings?.length > 0) {
      await createListings(
        {listings: listingsWithIds, scope},
        {updateSyncFile: options?.updateSyncFile}
      );
    }

    // return
    return scope;
  };

  return create;
}
