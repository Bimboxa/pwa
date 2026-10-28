import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { getBusinessObjectDescendants } from "../utils/buildBusinessObjectsTree";
import {
  getLinkedTemplateIds,
  isTemplateLinked,
} from "../utils/linkedTemplateIds";
import { isAnnotationExcluded } from "../utils/excludedAnnotationIds";

const EMPTY_SET = new Set();

// Set of annotationIds feeding the given business object OR any of its
// descendants: the rel-linked ones (relsBusinessObjectAnnotation) and the
// annotations of the templates linked by template (linkedTemplateIds), minus
// each object's exclusions (excludedAnnotationIds — same rule as
// resolveBusinessObjectAnnotationLinks: an annotation of a linked template
// feeds the solo when at least one object links it without excluding it).
// Used by the business-object SOLO filter in useAnnotationsV2 (clicking an
// object shows only its linked annotations, subtree included) — the filter
// intersects the set with the scope-filtered annotations, so the
// template-linked ids are collected project-wide without scope filtering.
// Queries only when an id is set; returns a stable empty Set otherwise.
export default function useBusinessObjectSoloAnnotationIdSet(businessObjectId) {
  const relsUpdatedAt = useSelector((s) => s.businessObjects?.relsUpdatedAt);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations?.annotationsUpdatedAt
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
    const objects = [
      object,
      ...getBusinessObjectDescendants(listingObjects, businessObjectId),
    ];
    const ids = objects.map((o) => o.id);
    const rels = await db.relsBusinessObjectAnnotation
      .where("businessObjectId")
      .anyOf(ids)
      .toArray();
    const result = rels.filter((r) => !r.deletedAt).map((r) => r.annotationId);

    // whole-template links: every live annotation of the linked templates
    const templateIds = [
      ...new Set(objects.flatMap((o) => getLinkedTemplateIds(o))),
    ];
    if (templateIds.length > 0) {
      const annotations = await db.annotations
        .where("annotationTemplateId")
        .anyOf(templateIds)
        .toArray();
      annotations.forEach((a) => {
        if (a.deletedAt || a.isMeshCell) return;
        if (object.projectId && a.projectId && a.projectId !== object.projectId)
          return;
        const feeds = objects.some(
          (o) =>
            isTemplateLinked(o, a.annotationTemplateId) &&
            !isAnnotationExcluded(o, a.id)
        );
        if (feeds) result.push(a.id);
      });
    }
    return result;
  }, [
    businessObjectId,
    relsUpdatedAt,
    businessObjectsUpdatedAt,
    annotationsUpdatedAt,
  ]);

  return useMemo(() => {
    if (!annotationIds?.length) return EMPTY_SET;
    return new Set(annotationIds);
  }, [annotationIds]);
}
