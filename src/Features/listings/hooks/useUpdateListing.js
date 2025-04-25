import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateListing() {
  const update = async (updates, options) => {
    const listingId = updates.id;

    const updatedAt = new Date(Date.now()).toISOString();

    await db.listings.update(listingId, {...updates, updatedAt});
    //
    const listing = await db.listings.get(listingId);
    await updateItemSyncFile({item: listing, type: "LISTING"});

    // sync file
    if (options.updateSyncFile) {
      const props = {item: listing, type: "LISTING"};
      if (options.updatedAt) props.updatedAt = options.updatedAt;
      if (options.syncAt) props.syncAt = options.syncAt;
      await updateItemSyncFile(props);
    }
  };

  return update;
}
