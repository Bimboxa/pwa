import useUpdateListing from "Features/listings/hooks/useUpdateListing";

import db from "App/db/db";

export default function useMoveAnnotation() {
  // data

  const updateListing = useUpdateListing();

  // main

  const move = async (annotation, position) => {
    console.log("debug_0912_moveAnnotation", annotation);
    if (!annotation?.id || !annotation.listingId) return;

    const listing = await db.listings.get(annotation.listingId);

    // sorted items

    let sortedAnnotationIds = listing?.sortedAnnotationIds;

    if (!Array.isArray(sortedAnnotationIds) && listing) {
      const items = await db.annotations
        .where("listingId")
        .equals(listing.id)
        .toArray();

      sortedAnnotationIds = items.map((i) => i.id);
    }

    // sort

    sortedAnnotationIds =
      sortedAnnotationIds?.filter((id) => id !== annotation.id) ?? [];

    if (position === "top") {
      sortedAnnotationIds = [...sortedAnnotationIds, annotation?.id];
    } else if (position === "bottom") {
      sortedAnnotationIds = [annotation?.id, ...sortedAnnotationIds];
    }

    // update listing
    const updates = { id: annotation.listingId, sortedAnnotationIds };
    console.log("debug_3110_updates", updates);
    await updateListing(updates);
  };

  // return

  return move;
}
