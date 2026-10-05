import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const SOURCE_TYPES = new Set(["POLYLINE", "POLYGON", "STRIP"]);

/**
 * Sources of a listing-level procedure run (listing.procedureKeys): returns
 * getSourceAnnotationIds(procedure) → ids of the annotations of the listing on
 * the base map whose template carries one of the procedure's
 * `sourceMappingCategories` (all of them when the procedure declares none),
 * minus the procedure's own outputs (results, not sources).
 *
 * The run then goes through the selection flow: resolved geometry + adjacency
 * context from the other templates / listings.
 */
export default function useListingProcedureSourceIds({
  listingId,
  baseMapId,
  enabled = true,
}) {
  // data

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // annotations of the listing on this base map, each with the mapping
  // categories of its template
  const listingAnnotations = useLiveQuery(async () => {
    if (!enabled || !listingId || !baseMapId) return [];
    const [annotations, templates] = await Promise.all([
      db.annotations.where("listingId").equals(listingId).toArray(),
      db.annotationTemplates.where("listingId").equals(listingId).toArray(),
    ]);
    const categoriesByTemplateId = new Map(
      templates.map((t) => [t.id, t.mappingCategories ?? []])
    );
    return annotations
      .filter(
        (a) =>
          !a.deletedAt && a.baseMapId === baseMapId && SOURCE_TYPES.has(a.type)
      )
      .map((a) => ({
        id: a.id,
        autoCreatedByProcedureKey: a.autoCreatedByProcedureKey,
        categories: categoriesByTemplateId.get(a.annotationTemplateId) ?? [],
      }));
  }, [enabled, listingId, baseMapId, annotationsUpdatedAt]);

  // helpers

  return useCallback(
    (procedure) => {
      const sourceCategories = procedure?.sourceMappingCategories ?? [];
      return (listingAnnotations ?? [])
        .filter((a) => a.autoCreatedByProcedureKey !== procedure?.key)
        .filter(
          (a) =>
            sourceCategories.length === 0 ||
            sourceCategories.some((c) => a.categories.includes(c))
        )
        .map((a) => a.id);
    },
    [listingAnnotations]
  );
}
