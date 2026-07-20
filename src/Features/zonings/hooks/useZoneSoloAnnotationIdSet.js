import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY_SET = new Set();

// Set of annotationIds linked (via relsZoneAnnotation) to the given zone.
// Used by the zone SOLO filter in useAnnotationsV2. Queries only when a
// zoneId is set; returns a stable empty Set otherwise.
export default function useZoneSoloAnnotationIdSet(zoneId) {
  const relsUpdatedAt = useSelector((s) => s.zonings?.relsUpdatedAt);

  const annotationIds = useLiveQuery(async () => {
    if (!zoneId) return null;
    const rels = await db.relsZoneAnnotation
      .where("zoneId")
      .equals(zoneId)
      .toArray();
    return rels.filter((r) => !r.deletedAt).map((r) => r.annotationId);
  }, [zoneId, relsUpdatedAt]);

  return useMemo(() => {
    if (!annotationIds?.length) return EMPTY_SET;
    return new Set(annotationIds);
  }, [annotationIds]);
}
