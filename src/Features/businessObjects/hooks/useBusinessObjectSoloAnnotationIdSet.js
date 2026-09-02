import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { getBusinessObjectDescendants } from "../utils/buildBusinessObjectsTree";

const EMPTY_SET = new Set();

// Set of annotationIds linked (via relsBusinessObjectAnnotation) to the given
// business object OR any of its descendants. Used by the business-object SOLO
// filter in useAnnotationsV2 (clicking an object shows only its linked
// annotations, subtree included). Queries only when an id is set; returns a
// stable empty Set otherwise.
export default function useBusinessObjectSoloAnnotationIdSet(businessObjectId) {
  const relsUpdatedAt = useSelector((s) => s.businessObjects?.relsUpdatedAt);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );

  const annotationIds = useLiveQuery(async () => {
    if (!businessObjectId) return null;
    const object = await db.businessObjects.get(businessObjectId);
    if (!object || object.deletedAt) return null;
    const listingObjects = (
      await db.businessObjects
        .where("listingId")
        .equals(object.listingId)
        .toArray()
    ).filter((o) => !o.deletedAt);
    const ids = [
      businessObjectId,
      ...getBusinessObjectDescendants(listingObjects, businessObjectId).map(
        (o) => o.id
      ),
    ];
    const rels = await db.relsBusinessObjectAnnotation
      .where("businessObjectId")
      .anyOf(ids)
      .toArray();
    return rels.filter((r) => !r.deletedAt).map((r) => r.annotationId);
  }, [businessObjectId, relsUpdatedAt, businessObjectsUpdatedAt]);

  return useMemo(() => {
    if (!annotationIds?.length) return EMPTY_SET;
    return new Set(annotationIds);
  }, [annotationIds]);
}
