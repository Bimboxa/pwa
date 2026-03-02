import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

/**
 * Parses a compact mapping-category string into an object.
 * Accepts both formats:
 *   "OUVRAGE:VOILE"                         → { nomenclatureKey: "OUVRAGE", categoryKey: "VOILE" }
 *   { nomenclatureKey, categoryKey }         → returned as-is
 *
 * Returns null for unrecognised values.
 */
function parseMappingCategory(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const parts = entry.split(":");
    if (parts.length !== 2) return null;
    const [nomenclatureKey, categoryKey] = parts.map((s) => s.trim());
    if (!nomenclatureKey || !categoryKey) return null;
    return { nomenclatureKey, categoryKey };
  }
  if (entry.nomenclatureKey && entry.categoryKey) return entry;
  return null;
}
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

export default function useCreateAnnotation() {
  const dispatch = useDispatch();
  const { value: listing } = useSelectedListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const createEntity = useCreateEntity();

  return async (annotation, options) => {
    try {
      // options

      const entityId = options?.entityId;

      // main
      const _annotation = {
        ...annotation,
        id: annotation?.id ?? nanoid(),
        projectId,
        listingId: annotation?.listingId ?? listing?.id,
      };

      if (entityId) _annotation.entityId = entityId;

      if (annotation.isScaleSegment) {
        _annotation.listingId = null;
      }

      await createEntity(_annotation, { listing: { id: _annotation.listingId, table: "annotations" } });

      // ── relAnnotationMappingCategory ────────────────────────────────────
      // If the annotation's template has mappingCategories, create the
      // relations so that resolveArticlesNomenclaturesWithQties can sum qtys.

      const annotationTemplateId = _annotation.annotationTemplateId;
      if (annotationTemplateId && _annotation.id && projectId) {
        try {
          const template = await db.annotationTemplates.get(annotationTemplateId);
          const rawMappingCategories = template?.mappingCategories ?? [];

          const mappingCategories = rawMappingCategories
            .map(parseMappingCategory)
            .filter(Boolean);

          if (mappingCategories.length > 0) {
            const rels = mappingCategories.map((mc) => ({
              id: nanoid(),
              annotationId: _annotation.id,
              projectId,
              nomenclatureKey: mc.nomenclatureKey,
              categoryKey: mc.categoryKey,
            }));
            await db.relAnnotationMappingCategory.bulkAdd(rels);
          }
        } catch (relError) {
          // Non-blocking: log but do not fail the annotation creation
          console.warn("[useCreateAnnotation] Could not create relAnnotationMappingCategory:", relError);
        }
      }

      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());

      return _annotation;
    } catch (e) {
      console.log("[useCreateAnnotation] error creating annotation", e);
      return null;
    }
  };
}
