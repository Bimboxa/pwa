import getItemsByKey from "Features/misc/utils/getItemsByKey";

import accumulateAnnotationQties, {
  createEmptyQties,
} from "./accumulateAnnotationQties";

// Rolls up the quantities of every business object from its linked
// annotations. No hierarchical aggregation (v1): an object only counts its own
// linked annotations. Mesh cells are skipped — their parent is already counted.
//
// Pure: the caller decides which annotations are in play, so the same rule
// serves the whole scope (useBusinessObjectQties) and a single base map (the
// SCOPE module recap).
//
// rels: [relBusinessObjectAnnotation], annotations: [annotation with .qties]
// => {qtiesByObjectId, annotationsByObjectId, mainRelsByObjectId,
//     mainAnnotationsByObjectId} — the last two hold the objects' MAIN
// annotations (rels flagged isMain, one per base map).
export default function computeBusinessObjectQties({ rels, annotations } = {}) {
  const annotationById = getItemsByKey(annotations ?? [], "id");
  const qtiesByObjectId = {};
  const annotationsByObjectId = {};
  const mainRelsByObjectId = {};
  const mainAnnotationsByObjectId = {};

  (rels ?? []).forEach((rel) => {
    const annotation = annotationById[rel.annotationId];
    if (!annotation) return;
    if (rel.isMain) {
      const objectId = rel.businessObjectId;
      if (!mainRelsByObjectId[objectId]) {
        mainRelsByObjectId[objectId] = [];
        mainAnnotationsByObjectId[objectId] = [];
      }
      mainRelsByObjectId[objectId].push(rel);
      mainAnnotationsByObjectId[objectId].push(annotation);
    }
    // Mesh cells are children of a parent annotation that is already
    // counted; skip them so quantities are not double-counted.
    if (annotation.isMeshCell) return;

    const objectId = rel.businessObjectId;
    if (!qtiesByObjectId[objectId]) {
      qtiesByObjectId[objectId] = createEmptyQties();
      annotationsByObjectId[objectId] = [];
    }
    annotationsByObjectId[objectId].push(annotation);

    accumulateAnnotationQties(qtiesByObjectId[objectId], annotation);
  });

  return {
    qtiesByObjectId,
    annotationsByObjectId,
    mainRelsByObjectId,
    mainAnnotationsByObjectId,
  };
}
