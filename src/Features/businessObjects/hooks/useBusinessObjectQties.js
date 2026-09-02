import { useMemo } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useRelsBusinessObjectAnnotation from "./useRelsBusinessObjectAnnotation";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

// Rolled-up quantities of every business object of a listing, from its linked
// annotations. No hierarchical aggregation (v1): an object only counts its
// own linked annotations.
// Returns {qtiesByObjectId: {count, length, surface}, annotationsByObjectId}.
export default function useBusinessObjectQties({ listingId } = {}) {
  // data

  const { value: rels } = useRelsBusinessObjectAnnotation({ listingId });

  const annotations = useAnnotationsV2({
    caller: "useBusinessObjectQties",
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    filterBySelectedScope: true,
  });

  // main

  return useMemo(() => {
    const annotationById = getItemsByKey(annotations ?? [], "id");
    const qtiesByObjectId = {};
    const annotationsByObjectId = {};

    (rels ?? []).forEach((rel) => {
      const annotation = annotationById[rel.annotationId];
      if (!annotation) return;
      // Mesh cells are children of a parent annotation that is already
      // counted; skip them so quantities are not double-counted.
      if (annotation.isMeshCell) return;

      const objectId = rel.businessObjectId;
      if (!qtiesByObjectId[objectId]) {
        qtiesByObjectId[objectId] = { count: 0, length: 0, surface: 0 };
        annotationsByObjectId[objectId] = [];
      }
      annotationsByObjectId[objectId].push(annotation);

      const stats = qtiesByObjectId[objectId];
      const qty = annotation.qties;
      // Unit count: 1 per annotation, except when the annotation carries its
      // own count (LINEAR_LAYOUT: qties.count = number of bars).
      stats.count += Number.isFinite(qty?.count) ? qty.count : 1;
      if (qty?.enabled) {
        // Prefer developed (sloped) values, like the template rollups.
        const length =
          qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
        const surface =
          qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
        if (Number.isFinite(length)) stats.length += length;
        if (Number.isFinite(surface)) stats.surface += surface;
      }
    });

    return { qtiesByObjectId, annotationsByObjectId };
  }, [rels, annotations]);
}
