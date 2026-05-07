import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

// All `isProfile === true` annotationTemplates whose `listingId` belongs to a
// listing of the currently selected scope. Used by the Shape3DSelector to
// populate the dynamic "Profils" section in the menu.
export default function useProfileAnnotationTemplates() {
  const { value: listings } = useListingsByScope() ?? {};
  const listingIds = (listings || []).map((l) => l.id);
  const listingIdsKey = listingIds.join(",");

  const templates = useLiveQuery(async () => {
    if (listingIds.length === 0) return [];
    const rows = await db.annotationTemplates
      .where("listingId")
      .anyOf(listingIds)
      .toArray();
    return rows.filter((t) => !t.deletedAt && t.isProfile === true);
  }, [listingIdsKey]);

  return templates ?? [];
}
