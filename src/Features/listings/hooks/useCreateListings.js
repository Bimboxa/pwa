import db from "App/db/db";
import {nanoid} from "@reduxjs/toolkit";
import useCreateRelsScopeItem from "Features/scopes/hooks/useCreateRelsScopeItem";
import useUserEmail from "Features/auth/hooks/useUserEmail";

export default function useCreateListings() {
  const createRelsScopeItem = useCreateRelsScopeItem();
  const createdBy = useUserEmail();
  const createdAt = Date.now();

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

    // relations with scope

    await createRelsScopeItem({
      scope,
      items: listingsClean,
      itemsTable: "listings",
    });
  };

  return create;
}
