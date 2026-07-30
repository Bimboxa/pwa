import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// The live photoPlan derived from a source POLYGON annotation, or null.
export default function usePhotoPlanByAnnotation({ annotationId } = {}) {
  // trigger

  const photoPlansUpdatedAt = useSelector(
    (s) => s.photoPlans.photoPlansUpdatedAt
  );

  // main

  const photoPlan = useLiveQuery(async () => {
    if (!annotationId) return null;
    const rows = await db.photoPlans
      .where("annotationId")
      .equals(annotationId)
      .toArray();
    return rows.find((p) => !p.deletedAt) ?? null;
  }, [annotationId, photoPlansUpdatedAt]);

  return { value: photoPlan, loading: photoPlan === undefined };
}
