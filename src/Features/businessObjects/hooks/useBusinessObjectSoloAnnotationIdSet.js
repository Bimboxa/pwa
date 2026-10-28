import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { getBusinessObjectDescendants } from "../utils/buildBusinessObjectsTree";
import { getLinkedTemplateIds } from "../utils/linkedTemplateIds";
import { getQtyFormulaKey } from "../utils/qtyFormula";
import { getTemplateViews3dByTemplateId } from "../utils/templateView3d";

const EMPTY_SET = new Set();
const EMPTY_MAP = new Map();
const EMPTY_RESULT = { idSet: EMPTY_SET, view3dByAnnotationId: EMPTY_MAP };

// Annotations feeding the given business object OR any of its descendants:
// the rel-linked ones (relsBusinessObjectAnnotation) and the annotations of
// the templates linked by template (linkedTemplateIds). Used by the
// business-object SOLO filter in useAnnotationsV2 (clicking an object shows
// only its linked annotations, subtree included) — the filter intersects the
// set with the scope-filtered annotations, so the template-linked ids are
// collected project-wide without scope filtering.
//
//   idSet                — Set<annotationId>
//   view3dByAnnotationId — Map<annotationId, view> for the annotations whose
//                          (object, template) pair has a NON-default
//                          "Affichage 3D" (utils/templateView3d); the 3D
//                          viewer renders them as edges / outline while the
//                          object is solo. Only the views of the object
//                          holding the link apply (rel: rel.businessObjectId,
//                          template link: the object linked to the
//                          template); an annotation reached through several
//                          objects of the subtree keeps the first view met.
//
// Queries only when an id is set; returns stable empty values otherwise.
export function useBusinessObjectSoloAnnotations(businessObjectId) {
  const relsUpdatedAt = useSelector((s) => s.businessObjects?.relsUpdatedAt);
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations?.annotationsUpdatedAt
  );

  const result = useLiveQuery(async () => {
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
    const viewsByObjectId = {};
    objects.forEach((o) => {
      const views = getTemplateViews3dByTemplateId(o);
      if (views) viewsByObjectId[o.id] = views;
    });
    const anyView = Object.keys(viewsByObjectId).length > 0;
    const entries = [];
    const seen = new Set();
    const pushView = (annotationId, view) => {
      if (!view || seen.has(annotationId)) return;
      seen.add(annotationId);
      entries.push([annotationId, view]);
    };

    const rels = (
      await db.relsBusinessObjectAnnotation
        .where("businessObjectId")
        .anyOf(ids)
        .toArray()
    ).filter((r) => !r.deletedAt);
    const result = rels.map((r) => r.annotationId);
    if (anyView && rels.length > 0) {
      const relAnnotations = await db.annotations.bulkGet(
        rels.map((r) => r.annotationId)
      );
      rels.forEach((r, i) => {
        const a = relAnnotations[i];
        if (!a || a.deletedAt) return;
        const views = viewsByObjectId[r.businessObjectId];
        pushView(a.id, views?.[getQtyFormulaKey(a.annotationTemplateId)]);
      });
    }

    // whole-template links: every live annotation of the linked templates
    const objectIdsByTemplateId = {};
    objects.forEach((o) => {
      getLinkedTemplateIds(o).forEach((templateId) => {
        (objectIdsByTemplateId[templateId] ??= []).push(o.id);
      });
    });
    const templateIds = Object.keys(objectIdsByTemplateId);
    if (templateIds.length > 0) {
      const annotations = await db.annotations
        .where("annotationTemplateId")
        .anyOf(templateIds)
        .toArray();
      annotations.forEach((a) => {
        if (a.deletedAt || a.isMeshCell) return;
        if (object.projectId && a.projectId && a.projectId !== object.projectId)
          return;
        result.push(a.id);
        if (!anyView) return;
        const key = getQtyFormulaKey(a.annotationTemplateId);
        objectIdsByTemplateId[a.annotationTemplateId].forEach((objectId) => {
          pushView(a.id, viewsByObjectId[objectId]?.[key]);
        });
      });
    }
    return { ids: result, entries };
  }, [
    businessObjectId,
    relsUpdatedAt,
    businessObjectsUpdatedAt,
    annotationsUpdatedAt,
  ]);

  return useMemo(() => {
    if (!result?.ids?.length) return EMPTY_RESULT;
    return {
      idSet: new Set(result.ids),
      view3dByAnnotationId: result.entries.length
        ? new Map(result.entries)
        : EMPTY_MAP,
    };
  }, [result]);
}

// Set of annotationIds only (see above).
export default function useBusinessObjectSoloAnnotationIdSet(businessObjectId) {
  return useBusinessObjectSoloAnnotations(businessObjectId).idSet;
}
