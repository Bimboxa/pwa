import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

/**
 * Bulk-create POLYLINE annotations from the global-detection result
 * (runGlobalFloorPlanDetection). Same batched pattern as
 * useCreateAnnotationsFromDetectedStrips:
 *   - all points → db.points.bulkAdd
 *   - all annotations → db.annotations.bulkAdd
 *
 * Each detected feature inherits the in-progress newAnnotation's template
 * props (strokeColor / strokeWidth / strokeWidthUnit / annotationTemplateId).
 * Per-feature width override (when the algo measured a wall thickness from
 * the image, in CM) takes precedence over the template width.
 *
 * Input:
 *   {
 *     features: Array<{
 *       kind: "WALL" | "PILLAR",
 *       centerline: [{x,y}, ...],     // **image-pixel** coords
 *       closeLine?: boolean,
 *       strokeWidth?: number,         // optional per-feature override
 *       strokeWidthUnit?: "CM" | "PX",
 *     }>,
 *     sourceAnnotation: {...},        // in-progress newAnnotation
 *   }
 */
export default function useCreateAnnotationsFromDetectedFeatures() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapIdSelected = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const listingIdSelected = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();

  return async ({ features, sourceAnnotation }) => {
    if (!features?.length) return [];

    const baseMapId = baseMap?.id ?? baseMapIdSelected;
    const { width, height } =
      baseMap?.getImageSize?.() ?? { width: 1, height: 1 };

    const {
      strokeWidth,
      strokeWidthUnit,
      strokeColor,
      fillColor,
      strokeOpacity,
      fillOpacity,
      strokeType,
      annotationTemplateId,
      templateLabel,
      listingId: sourceListingId,
      height: sourceHeight,
      isExt,
    } = sourceAnnotation || {};

    const templateProps = {
      type: "POLYLINE",
      strokeWidth,
      strokeWidthUnit,
      strokeColor,
      fillColor,
      strokeOpacity,
      fillOpacity,
      strokeType,
      annotationTemplateId,
      templateLabel,
      height: sourceHeight,
      isExt,
    };

    const listingId = sourceListingId ?? listingIdSelected;

    const allPoints = [];
    const allAnnotations = [];

    for (const feature of features) {
      const centerline = feature.centerline;
      if (!centerline || centerline.length < 2) continue;

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

      const annotation = {
        ...templateProps,
        id: nanoid(),
        baseMapId,
        projectId,
        listingId,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
        closeLine: feature.closeLine === true,
        ...(feature.strokeWidth != null && {
          strokeWidth: feature.strokeWidth,
          strokeWidthUnit: feature.strokeWidthUnit ?? strokeWidthUnit,
        }),
        points: pointIds.map((id) => ({ id })),
      };
      allAnnotations.push(annotation);
    }

    if (allPoints.length) await db.points.bulkAdd(allPoints);
    if (allAnnotations.length) await db.annotations.bulkAdd(allAnnotations);

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return allAnnotations;
  };
}
