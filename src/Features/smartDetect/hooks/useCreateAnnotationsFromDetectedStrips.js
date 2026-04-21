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
 * Bulk-create STRIP or POLYLINE annotations from the result of
 * detectStripFromLoupe (or detectSimilarStrips). Same pattern as
 * useSplitAnnotationsInSegments:
 *  - all points  → db.points.bulkAdd
 *  - all annotations → db.annotations.bulkAdd
 *  - all mapping rels → db.relAnnotationMappingCategory.bulkAdd
 *
 * Each strip inherits the source annotation's template props (strokeWidth,
 * fillColor, etc.). The output annotation type is taken from
 * `sourceAnnotation.type`:
 *   - "STRIP"    → stripOrientation is taken from the detection result
 *                  (computed per strip so the body covers the dark wall
 *                  pixels), falling back to the template value.
 *   - "POLYLINE" → no stripOrientation is written; the centerline is stored
 *                  as-is (SEGMENT_DETECTION produces centerlines on the
 *                  median axis of the dark band).
 *
 * Input:
 *   {
 *     strips: Array<{
 *       centerline: [{x,y}, {x,y}],   // local map coords
 *       stripOrientation?: 1 | -1,    // only used when type === "STRIP"
 *     }>,
 *     sourceAnnotation: {...}          // template / props source
 *   }
 */
export default function useCreateAnnotationsFromDetectedStrips() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapIdSelected = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const listingIdSelected = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();

  return async ({ strips, sourceAnnotation }) => {
    if (!strips?.length) return [];

    const baseMapId = baseMap?.id ?? baseMapIdSelected;
    const { width, height } =
      baseMap?.getImageSize?.() ?? { width: 1, height: 1 };

    // Pick only the props needed for new STRIP annotations from the source.
    const {
      type,
      strokeWidth,
      strokeWidthUnit,
      stripOrientation: templateStripOrientation,
      closeLine,
      strokeColor,
      fillColor,
      strokeOpacity,
      fillOpacity,
      strokeType,
      annotationTemplateId,
      templateLabel,
      listingId: sourceListingId,
      height: sourceHeight,
    } = sourceAnnotation || {};

    const templateProps = {
      type,
      strokeWidth,
      strokeWidthUnit,
      closeLine,
      strokeColor,
      fillColor,
      strokeOpacity,
      fillOpacity,
      strokeType,
      annotationTemplateId,
      templateLabel,
      height: sourceHeight,
    };

    const listingId = sourceListingId ?? listingIdSelected;

    // Mapping categories from the template — read once.
    let mappingCategories = [];
    if (annotationTemplateId && projectId) {
      try {
        const template = await db.annotationTemplates.get(annotationTemplateId);
        mappingCategories = (template?.mappingCategories ?? [])
          .map(parseMappingCategory)
          .filter(Boolean);
      } catch (e) {
        console.warn(
          "[useCreateAnnotationsFromDetectedStrips] mapping categories read failed:",
          e
        );
      }
    }

    const allPoints = [];
    const allAnnotations = [];
    const allMappingRels = [];

    for (const strip of strips) {
      const centerline = strip.centerline;
      if (!centerline || centerline.length < 2) continue;

      // Build & collect points
      const pointIds = [];
      for (const pt of centerline) {
        const id = nanoid();
        allPoints.push({
          id,
          x: pt.x / width,
          y: pt.y / height,
          baseMapId,
          projectId,
          listingId,
        });
        pointIds.push(id);
      }

      const annotationId = nanoid();
      const annotation = {
        ...templateProps,
        id: annotationId,
        baseMapId,
        projectId,
        listingId,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
        // Per-strip strokeWidth override (set by auto-detect in the caller)
        // — when absent, inherits templateProps.strokeWidth above.
        ...(strip.strokeWidth != null && {
          strokeWidth: strip.strokeWidth,
          strokeWidthUnit: strip.strokeWidthUnit ?? strokeWidthUnit,
        }),
        points: pointIds.map((id) => ({ id })),
      };
      // stripOrientation is only meaningful for STRIP annotations. For
      // POLYLINE (e.g. SEGMENT_DETECTION output) the centerline is already
      // on the median axis of the band, so no orientation is needed.
      if (type === "STRIP") {
        annotation.stripOrientation =
          strip.stripOrientation ?? templateStripOrientation;
      }
      allAnnotations.push(annotation);

      for (const mc of mappingCategories) {
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

    if (allPoints.length) await db.points.bulkAdd(allPoints);
    if (allAnnotations.length) await db.annotations.bulkAdd(allAnnotations);
    if (allMappingRels.length)
      await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return allAnnotations;
  };
}
