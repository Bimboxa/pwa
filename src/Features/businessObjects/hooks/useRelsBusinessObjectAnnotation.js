import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useRelsBusinessObjectAnnotation({
  annotationId,
  annotationIds,
  businessObjectId,
  listingId,
} = {}) {
  // trigger

  const relsUpdatedAt = useSelector((s) => s.businessObjects.relsUpdatedAt);

  // main

  const idsKey = annotationIds?.join(",") ?? "";

  const rels = useLiveQuery(async () => {
    let collection;
    if (annotationId) {
      collection = db.relsBusinessObjectAnnotation
        .where("annotationId")
        .equals(annotationId);
    } else if (annotationIds?.length) {
      collection = db.relsBusinessObjectAnnotation
        .where("annotationId")
        .anyOf(annotationIds);
    } else if (businessObjectId) {
      collection = db.relsBusinessObjectAnnotation
        .where("businessObjectId")
        .equals(businessObjectId);
    } else if (listingId) {
      collection = db.relsBusinessObjectAnnotation
        .where("listingId")
        .equals(listingId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((r) => !r.deletedAt);
  }, [annotationId, idsKey, businessObjectId, listingId, relsUpdatedAt]);

  return { value: rels, loading: rels === undefined };
}
