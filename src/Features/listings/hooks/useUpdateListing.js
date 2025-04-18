import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateListing() {
  const update = async (updates) => {
    const listingId = updates.id;

    const updatedAt = new Date(Date.now()).toISOString();

    await db.listings.update(listingId, {...updates, updatedAt});
    //
    const listing = await db.listings.get(listingId);
    await updateItemSyncFile({item: listing, type: "LISTING"});
  };

  return update;
}
