import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useRelsZoneAnnotation({
  annotationId,
  annotationIds,
  zoneId,
} = {}) {
  // trigger

  const relsUpdatedAt = useSelector((s) => s.zonings.relsUpdatedAt);

  // main

  const idsKey = annotationIds?.join(",") ?? "";

  const rels = useLiveQuery(async () => {
    let collection;
    if (annotationId) {
      collection = db.relsZoneAnnotation
        .where("annotationId")
        .equals(annotationId);
    } else if (annotationIds?.length) {
      collection = db.relsZoneAnnotation
        .where("annotationId")
        .anyOf(annotationIds);
    } else if (zoneId) {
      collection = db.relsZoneAnnotation.where("zoneId").equals(zoneId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((r) => !r.deletedAt);
  }, [annotationId, idsKey, zoneId, relsUpdatedAt]);

  return { value: rels, loading: rels === undefined };
}
