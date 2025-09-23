import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useAnnotationTemplates() {
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  return useLiveQuery(async () => {
    return await db.annotationTemplates
      .where("listingId")
      .equals(listingId)
      .toArray();
  }, [listingId, annotationsUpdatedAt]);
}
