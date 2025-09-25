import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useAnnotationTemplates(options) {
  // options

  const filterByListingId = options?.filterByListingId;

  // data

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  return useLiveQuery(async () => {
    if (filterByListingId) {
      return await db.annotationTemplates
        .where("listingId")
        .equals(filterByListingId)
        .toArray();
    } else {
      return await db.annotationTemplates.toArray();
    }
  }, [filterByListingId, annotationsUpdatedAt]);
}
