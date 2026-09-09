import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY_SET = new Set();

// Set of the annotationIds linked to a work package (work-package SOLO of
// useAnnotationsV2). Queries only when an id is set; stable empty Set
// otherwise.
export default function useWorkPackageSoloAnnotationIdSet(workPackageId) {
  const relsUpdatedAt = useSelector(
    (s) => s.businessObjects?.relsWorkPackageUpdatedAt
  );

  const ids = useLiveQuery(async () => {
    if (!workPackageId) return null;
    const rels = await db.relsWorkPackageAnnotation
      .where("workPackageId")
      .equals(workPackageId)
      .toArray();
    return rels.filter((r) => !r.deletedAt).map((r) => r.annotationId);
  }, [workPackageId, relsUpdatedAt]);

  return useMemo(() => {
    if (!ids?.length) return EMPTY_SET;
    return new Set(ids);
  }, [ids]);
}
