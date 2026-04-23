import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

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

/**
 * Bulk-create a single POLYGON annotation from the SURFACE_DROP
 * smartDetect flood-fill commit path (click or Space).
 *
 * Same batched pattern as useCreateAnnotationsFromDetectedStrips:
 * one template read, then a single bulkAdd per table. Skips the per-call
 * sequential `createEntity → points.bulkAdd → createAnnotation` chain of
 * `saveTempAnnotations` — visible as a delay on Space commit because the
 * flood-fill itself is already done at that point.
 *
 * Input:
 *   {
 *     points,                 // [{x, y}] in local map coords, required
 *     cuts,                   // optional — [{points: [{x,y}, ...]}]
 *     newAnnotation,          // template-bearing annotation (drawingShape,
 *                             // annotationTemplateId, colors, etc.)
 *   }
 */
export default function useCreateAnnotationFromSurfaceDrop() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapIdSelected = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const listingIdSelected = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();

  return async ({ points, cuts, newAnnotation }) => {
    if (!points || points.length < 3) return null;
    if (!baseMap) return null;

    const baseMapId = baseMap?.id ?? baseMapIdSelected;
    const { width, height } = baseMap?.getImageSize?.() ?? {
      width: 1,
      height: 1,
    };
    const listingId = newAnnotation?.listingId ?? listingIdSelected;

    const allPoints = [];

    const resolvePointIds = (pts) => {
      const ids = [];
      for (const pt of pts) {
        const id = nanoid();
        allPoints.push({
          id,
          x: pt.x / width,
          y: pt.y / height,
          baseMapId,
          projectId,
          listingId,
        });
        ids.push(id);
      }
      return ids;
    };

    const mainIds = resolvePointIds(points);
    const finalCuts = [];
    if (cuts && cuts.length > 0) {
      for (const cut of cuts) {
        if (!cut?.points) continue;
        const cutIds = resolvePointIds(cut.points);
        finalCuts.push({ points: cutIds.map((id) => ({ id })) });
      }
    }

    const annotationId = nanoid();
    const annotation = {
      ...newAnnotation,
      id: annotationId,
      baseMapId,
      projectId,
      listingId,
      ...(activeLayerId ? { layerId: activeLayerId } : {}),
      type: newAnnotation?.type || "POLYGON",
      points: mainIds.map((id) => ({ id })),
      cuts: finalCuts.length > 0 ? finalCuts : null,
      closeLine:
        newAnnotation?.closeLine !== undefined ? newAnnotation.closeLine : true,
    };

    // Mapping categories (single read — same as detectedStrips path).
    let mappingCategories = [];
    const annotationTemplateId = newAnnotation?.annotationTemplateId;
    if (annotationTemplateId && projectId) {
      try {
        const template = await db.annotationTemplates.get(annotationTemplateId);
        mappingCategories = (template?.mappingCategories ?? [])
          .map(parseMappingCategory)
          .filter(Boolean);
      } catch (e) {
        console.warn(
          "[useCreateAnnotationFromSurfaceDrop] mapping categories read failed:",
          e
        );
      }
    }
    const mappingRels = mappingCategories.map((mc) => ({
      id: nanoid(),
      annotationId,
      projectId,
      nomenclatureKey: mc.nomenclatureKey,
      categoryKey: mc.categoryKey,
      source: "annotationTemplate",
    }));

    // Match useCreateAnnotationsFromDetectedStrips byte-for-byte: three
    // bulkAdd calls (no transaction wrapper, no entity creation, no
    // extra dispatches). The Space-commit feels instant when the DB
    // path is this tight.
    if (allPoints.length) await db.points.bulkAdd(allPoints);
    await db.annotations.bulkAdd([annotation]);
    if (mappingRels.length)
      await db.relAnnotationMappingCategory.bulkAdd(mappingRels);

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return annotation;
  };
}
