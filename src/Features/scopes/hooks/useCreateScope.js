import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateListings from "Features/listings/hooks/useCreateListings";

import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateScope() {
  const {value: createdBy} = useUserEmail();
  const createdAt = new Date(Date.now()).toISOString();

  const createListings = useCreateListings();

  const create = async ({
    id,
    name,
    clientRef,
    projectId,
    newListings,
    sortedListingsIds,
  }) => {
    //
    const listingsWithIds = newListings?.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
      };
    });
    //
    sortedListingsIds =
      sortedListingsIds ?? listingsWithIds?.map((listing) => listing.id);
    //
    const scope = {
      id: id ?? nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
      projectId,
      sortedListingsIds,
    };
    await db.scopes.add(scope);
    console.log("[db] added scope", scope);

    // add listings
    if (newListings?.length > 0) {
      await createListings({listings: listingsWithIds, scope});
    }

    // update sync file
    await updateItemSyncFile({item: scope, type: "SCOPE"});

    // return
    return scope;
  };

  return create;
}
