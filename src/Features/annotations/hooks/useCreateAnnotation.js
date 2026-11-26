import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { isLegacyStyleRevolutionHelper } from "Features/annotations/constants/drawingShapeConfig";
import { isScopeBoundBaseMapLink } from "Features/baseMapLinks/utils/baseMapLinkPredicates";

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
import { isTemplatelessAnnotation } from "../utils/templatelessAnnotations";
import getNextAutoNumberLabelAsync, {
  createAutoNumberLabelAllocator,
} from "../services/getNextAutoNumberLabelAsync";
import requestSubtractOnContactSync from "../services/requestSubtractOnContactSync";

// Annotations whose label is owned by another mechanism: never auto-numbered.
function isAutoNumberExempt(annotation) {
  return Boolean(
    annotation?.isBaseMapAnnotation ||
    annotation?.isZoneAnnotation ||
    annotation?.isBusinessObjectAnnotation ||
    annotation?.isScaleSegment ||
    annotation?.isMeshCell ||
    annotation?.isTemplateless ||
    annotation?.type === "REVOLUTION_AXIS" ||
    annotation?.type === "DETAIL" ||
    annotation?.type === "BASE_MAP_LINK"
  );
}

export default function useCreateAnnotation() {
  const dispatch = useDispatch();
  const { value: listing } = useSelectedListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const createEntity = useCreateEntity();

  return async (annotation, options) => {
    try {
      // options

      // Deferred writes from the drawing commit (see useHandleCommitDrawing):
      // point rows + snap updates land in the SAME Dexie transaction as the
      // annotation add, so the liveQueries re-run once per commit.
      const pointRowsToSave = options?.pointRowsToSave ?? [];
      const annotationUpdatesInTx = options?.annotationUpdatesInTx ?? [];
      // Batch of one drawing commit (« Texturer une zone rectangulaire »):
      // `siblingRows` are { id, ...own fields } of extra annotations that
      // are otherwise identical to this one. They are added in the SAME
      // transaction, each with its own auto-number label and mapping rels.
      const siblingRows = options?.siblingRows ?? [];
      const allocateAutoLabel = siblingRows.length
        ? createAutoNumberLabelAllocator()
        : null;
      const siblingLabelById = new Map();

      // main
      const _annotation = {
        ...annotation,
        id: annotation?.id ?? nanoid(),
        projectId,
        listingId: annotation?.listingId ?? listing?.id,
      };

      if (annotation.isScaleSegment) {
        _annotation.listingId = null;
      }

      // Pre-template revolution helpers belong to a scope + a base map only.
      // Without this the `?? listing?.id` fallback above would silently
      // re-attach them to the selected listing and inflate its annotation
      // counter. Template-linked helpers are normal listing annotations.
      if (isLegacyStyleRevolutionHelper(_annotation)) {
        _annotation.listingId = null;
      }

      // Same rule for the section marks drawn from the Fonds de plan module
      // (no template): a base map + a scope, never a listing.
      if (isScopeBoundBaseMapLink(_annotation)) {
        _annotation.listingId = null;
      }

      // Templateless annotations ("Dessin" tool) belong to a scope + a base
      // map only: same rule, never re-attached to the selected listing. The
      // ones drawn on a located business object carry that listing's id on
      // purpose (useHandleCommitDrawing) and keep it.
      if (isTemplatelessAnnotation(_annotation) && !annotation?.listingId) {
        _annotation.listingId = null;
      }

      // ── Auto-numbered label (listing option) ────────────────────────────
      // Deliberately overwrites the draft label (the template NAME copied by
      // ALWAYS_COPY_KEYS), like the entity label used to at read time.
      // Read OUTSIDE the transaction below.
      if (!options?.skipAutoNumber && !isAutoNumberExempt(_annotation)) {
        // A batch numbers its rows sequentially from one allocator.
        const autoLabel = allocateAutoLabel
          ? await allocateAutoLabel(_annotation.listingId)
          : await getNextAutoNumberLabelAsync(_annotation.listingId);
        if (autoLabel) _annotation.label = autoLabel;
        for (const sibling of siblingRows) {
          const siblingLabel = await allocateAutoLabel(_annotation.listingId);
          if (siblingLabel) siblingLabelById.set(sibling.id, siblingLabel);
        }
      }

      // ── relAnnotationMappingCategory ────────────────────────────────────
      // If the annotation's template has mappingCategories, create the
      // relations so that resolveArticlesNomenclaturesWithQties can sum qtys.
      // Built BEFORE the write so the rows join the commit transaction.

      let rels = [];
      const annotationTemplateId = _annotation.annotationTemplateId;
      if (annotationTemplateId && _annotation.id && projectId) {
        try {
          const template =
            await db.annotationTemplates.get(annotationTemplateId);
          const rawMappingCategories = template?.mappingCategories ?? [];

          const mappingCategories = rawMappingCategories
            .map(parseMappingCategory)
            .filter(Boolean);

          rels = mappingCategories.map((mc) => ({
            id: nanoid(),
            annotationId: _annotation.id,
            projectId,
            nomenclatureKey: mc.nomenclatureKey,
            categoryKey: mc.categoryKey,
            source: "annotationTemplate",
          }));
        } catch (relError) {
          // Non-blocking: log but do not fail the annotation creation
          console.warn(
            "[useCreateAnnotation] Could not create relAnnotationMappingCategory:",
            relError
          );
        }
      }

      await createEntity(_annotation, {
        listing: { id: _annotation.listingId, table: "annotations" },
        tx: {
          tables: [db.points, db.annotations, db.relAnnotationMappingCategory],
          writes: async () => {
            if (pointRowsToSave.length > 0) {
              await db.points.bulkAdd(pointRowsToSave);
            }
            for (const u of annotationUpdatesInTx) {
              await db.annotations.update(u.id, u.changes);
            }
            if (rels.length > 0) {
              await db.relAnnotationMappingCategory.bulkAdd(rels);
            }
            if (siblingRows.length > 0) {
              // Cloned from the row just added (same transaction), so they
              // carry exactly what the entity pipeline stored.
              const stored = await db.annotations.get(_annotation.id);
              await db.annotations.bulkAdd(
                siblingRows.map((sibling) => ({
                  ...stored,
                  ...sibling,
                  ...(siblingLabelById.has(sibling.id)
                    ? { label: siblingLabelById.get(sibling.id) }
                    : {}),
                }))
              );
              if (rels.length > 0) {
                await db.relAnnotationMappingCategory.bulkAdd(
                  siblingRows.flatMap((sibling) =>
                    rels.map((rel) => ({
                      ...rel,
                      id: nanoid(),
                      annotationId: sibling.id,
                    }))
                  )
                );
              }
            }
          },
        },
      });

      // « Soustraire au contact »: a no-op unless the annotation (or its
      // template) carries the option.
      requestSubtractOnContactSync([
        _annotation.id,
        ...siblingRows.map((sibling) => sibling.id),
      ]);

      // skipTriggers: a batch creating several annotations dispatches the
      // two triggers itself, once, after its last write.
      if (!options?.skipTriggers) {
        dispatch(triggerAnnotationsUpdate());
        dispatch(triggerAnnotationTemplatesUpdate());
      }

      return _annotation;
    } catch (e) {
      console.log("[useCreateAnnotation] error creating annotation", e);
      return null;
    }
  };
}
