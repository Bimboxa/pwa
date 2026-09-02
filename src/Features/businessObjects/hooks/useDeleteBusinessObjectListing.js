import { useDispatch } from "react-redux";

import { triggerBusinessObjectsUpdate } from "../businessObjectsSlice";

import db from "App/db/db";
import useDeleteBusinessObject from "./useDeleteBusinessObject";

export default function useDeleteBusinessObjectListing() {
  const dispatch = useDispatch();
  const deleteBusinessObject = useDeleteBusinessObject();

  // Deletes a business-objects listing: cascades on its root objects (which
  // handles descendants and rels), then soft-deletes the listing itself.
  const deleteBusinessObjectListing = async (listing) => {
    const objects = (
      await db.businessObjects.where("listingId").equals(listing.id).toArray()
    ).filter((o) => !o.deletedAt);
    const rootObjects = objects.filter(
      (o) => !o.parentId || !objects.some((other) => other.id === o.parentId)
    );

    for (const object of rootObjects) {
      await deleteBusinessObject(object);
    }

    await db.listings.delete(listing.id);
    dispatch(triggerBusinessObjectsUpdate());
  };

  return deleteBusinessObjectListing;
}
