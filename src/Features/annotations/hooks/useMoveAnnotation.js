import useUpdateListing from "Features/listings/hooks/useUpdateListing";

import db from "App/db/db";

export default function useMoveAnnotation() {
  // data

  const updateListing = useUpdateListing();

  // main

  const move = async (annotation, position) => {
    if (!annotation?.id || !annotation.listingId) return;

    const listing = await db.listings.get(annotation.listingId);

    // sorted items

    let sortedItemIds = listing?.sortedItemIds;

    if (!Array.isArray(sortedItemIds) && listing) {
      const items = await db.annotations
        .where("listingId")
        .equals(listing.id)
        .toArray();

      sortedItemIds = items.map((i) => i.id);
    }

    // sort

    sortedItemIds = sortedItemIds?.filter((id) => id !== annotation.id) ?? [];

    if (position === "top") {
      sortedItemIds = [...sortedItemIds, annotation?.id];
    } else if (position === "bottom") {
      sortedItemIds = [annotation?.id, ...sortedItemIds];
    }

    // update listing
    const updates = { id: annotation.listingId, sortedItemIds };
    console.log("debug_3110_updates", updates);
    await updateListing(updates);
  };

  // return

  return move;
}
