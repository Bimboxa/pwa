import db from "App/db/db";
import {nanoid} from "@reduxjs/toolkit";
import useCreateRelsScopeItem from "Features/scopes/hooks/useCreateRelsScopeItem";
import useUserEmail from "Features/auth/hooks/useUserEmail";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateListings() {
  const createRelsScopeItem = useCreateRelsScopeItem();
  const createdBy = useUserEmail();
  const createdAt = new Date(Date.now()).toISOString();

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
        return updateItemSyncFile({
          item: listing,
          type: "LISTING",
        });
      })
    );

    // relations with scope

    await createRelsScopeItem({
      scope,
      items: listingsClean,
      itemsTable: "listings",
    });
  };

  return create;
}
