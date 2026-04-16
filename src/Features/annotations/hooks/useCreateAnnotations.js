import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

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
 * Bulk-create many annotations in a single pass:
 *   - all points → db.points.bulkAdd
 *   - all annotations → db.annotations.bulkAdd
 *   - all mapping rels → db.relAnnotationMappingCategory.bulkAdd
 *
 * Mirrors the behaviour of useSaveTempAnnotations but replaces the per-item
 * loop of createEntity/createAnnotation calls with three bulkAdd calls.
 * Use this for mass creation flows (detected strips, split segments, etc.)
 * — it is significantly faster than calling useCreateAnnotation in a loop.
 *
 * Input: array of annotation specs with raw {x, y} points in image-local
 * coords (NOT normalized). Coords are divided by baseMap imageSize before
 * persistence, matching the convention used elsewhere.
 *
 * Mapping categories are fetched once per distinct annotationTemplateId.
 */
export default function useCreateAnnotations() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapIdSelected = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const listingIdSelected = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();

  return async (annotationsInput) => {
    if (!annotationsInput || annotationsInput.length === 0) return [];

    const { width, height } =
      baseMap?.getImageSize?.() ?? { width: 1, height: 1 };

    const allPoints = [];
    const allAnnotations = [];
    const allMappingRels = [];

    // Cache mapping categories per annotationTemplateId (one DB read each).
    const templatesCache = new Map();

    for (const tempAnn of annotationsInput) {
      if (!tempAnn?.points?.length) continue;

      const annotationId = tempAnn.id ?? nanoid();
      const baseMapId = tempAnn.baseMapId ?? baseMapIdSelected;
      const listingId = tempAnn.listingId ?? listingIdSelected;

      const processPoints = (pts) => {
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
            forMarker: tempAnn.type === "MARKER",
          });
          ids.push(id);
        }
        return ids;
      };

      const mainPointIds = processPoints(tempAnn.points);

      const finalCuts = [];
      if (tempAnn.cuts?.length) {
        for (const cut of tempAnn.cuts) {
          const cutIds = processPoints(cut.points || []);
          finalCuts.push({ points: cutIds.map((id) => ({ id })) });
        }
      }

      allAnnotations.push({
        ...tempAnn,
        id: annotationId,
        baseMapId,
        projectId,
        listingId,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
        points: mainPointIds.map((id) => ({ id })),
        cuts: finalCuts,
        type: tempAnn.type || "POLYGON",
        strokeColor: tempAnn.strokeColor || "#2196f3",
        fillColor: tempAnn.fillColor || "#2196f3",
        closeLine:
          tempAnn.closeLine !== undefined ? tempAnn.closeLine : true,
      });

      // Mapping categories from template (cached per templateId).
      const tplId = tempAnn.annotationTemplateId;
      if (tplId && projectId) {
        let cats = templatesCache.get(tplId);
        if (cats === undefined) {
          const template = await db.annotationTemplates.get(tplId);
          cats = (template?.mappingCategories ?? [])
            .map(parseMappingCategory)
            .filter(Boolean);
          templatesCache.set(tplId, cats);
        }
        for (const mc of cats) {
          allMappingRels.push({
            id: nanoid(),
            annotationId,
            projectId,
            nomenclatureKey: mc.nomenclatureKey,
            categoryKey: mc.categoryKey,
            source: "annotationTemplate",
          });
        }
      }
    }

    if (allPoints.length) await db.points.bulkAdd(allPoints);
    if (allAnnotations.length) await db.annotations.bulkAdd(allAnnotations);
    if (allMappingRels.length)
      await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return allAnnotations;
  };
}
