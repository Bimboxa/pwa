import { useDispatch } from "react-redux";

import { triggerZonesUpdate } from "../zoningsSlice";

import db from "App/db/db";
import useDeleteZone from "./useDeleteZone";

export default function useDeleteZoningListing() {
  const dispatch = useDispatch();
  const deleteZone = useDeleteZone();

  // Deletes a zoning listing: cascades on its root zones (which handles
  // descendants, templates, delimitation annotations and rels), then
  // soft-deletes the listing itself.
  const deleteZoningListing = async (listing) => {
    const zones = (
      await db.zones.where("listingId").equals(listing.id).toArray()
    ).filter((z) => !z.deletedAt);
    const rootZones = zones.filter(
      (z) => !z.parentId || !zones.some((other) => other.id === z.parentId)
    );

    for (const zone of rootZones) {
      await deleteZone(zone);
    }

    await db.listings.delete(listing.id);
    dispatch(triggerZonesUpdate());
  };

  return deleteZoningListing;
}
