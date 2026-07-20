import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useRelsZoneAnnotation({ annotationId, zoneId } = {}) {
  // trigger

  const relsUpdatedAt = useSelector((s) => s.zonings.relsUpdatedAt);

  // main

  const rels = useLiveQuery(async () => {
    let collection;
    if (annotationId) {
      collection = db.relsZoneAnnotation
        .where("annotationId")
        .equals(annotationId);
    } else if (zoneId) {
      collection = db.relsZoneAnnotation.where("zoneId").equals(zoneId);
    } else {
      return [];
    }
    const rows = await collection.toArray();
    return rows.filter((r) => !r.deletedAt);
  }, [annotationId, zoneId, relsUpdatedAt]);

  return { value: rels, loading: rels === undefined };
}
