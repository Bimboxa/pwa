import {nanoid} from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateListings from "Features/listings/hooks/useCreateListings";

import db from "App/db/db";

export default function useCreateScope() {
  const {value: createdBy} = useUserEmail();
  const createdAt = new Date(Date.now()).toISOString();

  const createListings = useCreateListings();

  const create = async ({name, clientRef, projectId, newListings}) => {
    const listingsWithIds = newListings.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
      };
    });
    const scope = {
      id: nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
      projectId,
      sortedListingsIds: listingsWithIds.map((listing) => listing.id),
    };
    await db.scopes.add(scope);
    console.log("[db] added scope", scope);

    // add listings
    if (newListings?.length > 0) {
      await createListings({listings: listingsWithIds, scope});
    }
  };

  return create;
}
