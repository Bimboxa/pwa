import { getLinkedTemplateIds } from "./linkedTemplateIds.js";
import { getExcludedAnnotationIds } from "./excludedAnnotationIds.js";

// Annotations feeding each business object = the rel-linked ones ("Lien par
// annotation", db.relsBusinessObjectAnnotation) ∪ the template-linked ones
// ("Lien par modèle", businessObject.linkedTemplateIds: every annotation of
// the template among `annotations`, mesh cells and templateless annotations
// excluded) minus the object's exclusions (businessObject.excludedAnnotationIds,
// see excludedAnnotationIds.js). One row per (object, annotation) whatever
// the number of links, so the rollups never count an annotation twice.
//
// An exclusion only removes an annotation from the template expansion: a
// rel-linked annotation always counts (the writers keep the two mutually
// exclusive; if both exist, the rel wins here), and an exclusion whose
// template is not linked by template is ignored.
//
// Shared by computeBusinessObjectQties (tree, gap popper, SCOPE recap,
// Prompt IA, hours budget) and the object properties panel (linkedRows).
//
// rels: [relBusinessObjectAnnotation]; annotations: the annotations in
// play (the caller decides: whole scope or one base map); businessObjects
// (optional): the objects, for their template links — omitted = rels only.
// => {rowsByObjectId: {[objectId]: [{annotation, rel | null, byAnnotation,
//     byTemplate}]}} — rel = the rel of the annotation when linked by
//     annotation (main rels included), null for a template-only row.
export default function resolveBusinessObjectAnnotationLinks({
  rels,
  annotations,
  businessObjects,
} = {}) {
  const annotationById = {};
  const annotationsByTemplateId = {};
  (annotations ?? []).forEach((annotation) => {
    annotationById[annotation.id] = annotation;
    if (annotation.isMeshCell || !annotation.annotationTemplateId) return;
    const templateId = annotation.annotationTemplateId;
    if (!annotationsByTemplateId[templateId])
      annotationsByTemplateId[templateId] = [];
    annotationsByTemplateId[templateId].push(annotation);
  });

  // objectId => Map(annotationId => row), insertion order = rels first
  const mapByObjectId = {};
  function getMap(objectId) {
    if (!mapByObjectId[objectId]) mapByObjectId[objectId] = new Map();
    return mapByObjectId[objectId];
  }

  (rels ?? []).forEach((rel) => {
    const annotation = annotationById[rel.annotationId];
    if (!annotation) return;
    const map = getMap(rel.businessObjectId);
    const row = map.get(annotation.id);
    if (row) {
      row.byAnnotation = true;
      // several live rels on the same pair should not happen; keep the main
      // one if any so the "Localisation" rows stay visible
      if (!row.rel || (rel.isMain && !row.rel.isMain)) row.rel = rel;
      return;
    }
    map.set(annotation.id, {
      annotation,
      rel,
      byAnnotation: true,
      byTemplate: false,
    });
  });

  (businessObjects ?? []).forEach((businessObject) => {
    const templateIds = getLinkedTemplateIds(businessObject);
    if (templateIds.length === 0) return;
    const excludedIds = new Set(getExcludedAnnotationIds(businessObject));
    templateIds.forEach((templateId) => {
      const templateAnnotations = annotationsByTemplateId[templateId];
      if (!templateAnnotations) return;
      const map = getMap(businessObject.id);
      templateAnnotations.forEach((annotation) => {
        // excluded from the template expansion (a rel on the same pair, if
        // any, was inserted above and keeps counting)
        if (excludedIds.has(annotation.id)) return;
        const row = map.get(annotation.id);
        if (row) {
          row.byTemplate = true;
          return;
        }
        map.set(annotation.id, {
          annotation,
          rel: null,
          byAnnotation: false,
          byTemplate: true,
        });
      });
    });
  });

  const rowsByObjectId = {};
  Object.entries(mapByObjectId).forEach(([objectId, map]) => {
    rowsByObjectId[objectId] = [...map.values()];
  });
  return { rowsByObjectId };
}
