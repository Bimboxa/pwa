import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY = [];

// Live relsWorkPackageAnnotation rows by listing, work package or annotation
// (one filter at a time; nothing => empty).
export default function useRelsWorkPackageAnnotation({
  listingId,
  workPackageId,
  annotationId,
} = {}) {
  const relsUpdatedAt = useSelector(
    (s) => s.businessObjects.relsWorkPackageUpdatedAt
  );

  const rows = useLiveQuery(async () => {
    let collection;
    if (workPackageId) {
      collection = db.relsWorkPackageAnnotation
        .where("workPackageId")
        .equals(workPackageId);
    } else if (annotationId) {
      collection = db.relsWorkPackageAnnotation
        .where("annotationId")
        .equals(annotationId);
    } else if (listingId) {
      collection = db.relsWorkPackageAnnotation
        .where("listingId")
        .equals(listingId);
    } else {
      return [];
    }
    const all = await collection.toArray();
    return all.filter((r) => !r.deletedAt);
  }, [listingId, workPackageId, annotationId, relsUpdatedAt]);

  const value = useMemo(() => rows ?? EMPTY, [rows]);
  return { value, loading: rows === undefined };
}
