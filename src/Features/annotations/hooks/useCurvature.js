import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useDeleteAnnotations from "./useDeleteAnnotations";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

import fitCircleArcThroughPoints from "Features/geometry/utils/fitCircleArcThroughPoints";

// Builds the static (non-points) part of the new arc POLYLINE annotation from
// the first selected polyline. Copies visual / template-related fields so the
// arc renders identically. Does NOT copy entity-specific fields (entityId,
// label, num) — the selection is being replaced by one independent arc.
function buildArcSkeleton(parent, fallbackProjectId) {
  return {
    id: nanoid(),
    type: "POLYLINE",
    annotationTemplateId: parent.annotationTemplateId,
    annotationTemplateProps: parent.annotationTemplateProps,
    listingId: parent.listingId,
    projectId: parent.projectId ?? fallbackProjectId,
    baseMapId: parent.baseMapId,
    strokeColor: parent.strokeColor,
    strokeWidth: parent.strokeWidth,
    strokeWidthUnit: parent.strokeWidthUnit,
    strokeOpacity: parent.strokeOpacity,
    strokeType: parent.strokeType,
    strokeOffset: parent.strokeOffset,
    overrideFields: parent.overrideFields,
    ...(parent.layerId ? { layerId: parent.layerId } : {}),
    ...(parent.hidden !== undefined ? { hidden: parent.hidden } : {}),
    ...(parent.isForBaseMaps !== undefined
      ? { isForBaseMaps: parent.isForBaseMaps }
      : {}),
  };
}

export default function useCurvature() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const deleteAnnotations = useDeleteAnnotations();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (annotations) => {
    const polylines = (annotations || []).filter(
      (a) =>
        a?.type === "POLYLINE" &&
        Array.isArray(a.points) &&
        a.points.length >= 2
    );

    if (polylines.length < 2) {
      console.error("[curvature] need at least 2 selected POLYLINEs");
      return { addedCount: 0, deletedCount: 0 };
    }

    // Image size — used to convert pixel coords back to normalized [0..1]
    // before storage. Match useAnnotationsV2's order: method first, then prop.
    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    const width = imageSize?.width || 1;
    const height = imageSize?.height || 1;

    // Annotation points are already resolved to pixel space here (same
    // contract useCleanSegments relies on).
    const pxPoints = [];
    for (const a of polylines) {
      for (const p of a.points) {
        if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
          pxPoints.push({ x: p.x, y: p.y });
        }
      }
    }

    const fit = fitCircleArcThroughPoints(pxPoints);
    if (!fit) {
      console.error(
        "[curvature] circle fit failed (collinear / <3 distinct pts)"
      );
      return { addedCount: 0, deletedCount: 0 };
    }
    if (fit.span > Math.PI) {
      console.warn("[curvature] span > 180°, emitting S-C-S-C-S chain");
    }

    const skeleton = buildArcSkeleton(polylines[0], projectId);

    // Mint fresh point ids; persist normalized [0..1] coords in db.points.
    // The annotation's `points` field is only [{id, type}] references.
    const pointsToBulkAdd = [];
    const points = fit.chainPoints.map((p) => {
      const id = nanoid();
      pointsToBulkAdd.push({
        id,
        x: p.x / width,
        y: p.y / height,
        projectId: skeleton.projectId,
        baseMapId: skeleton.baseMapId,
      });
      return { id, type: p.type };
    });

    const newAnnotation = { ...skeleton, points };
    const deleteIds = polylines.map((a) => a.id);

    // Persist atomically: insert points → insert the arc annotation.
    await db.transaction("rw", [db.annotations, db.points], async () => {
      if (pointsToBulkAdd.length > 0) {
        await db.points.bulkAdd(pointsToBulkAdd);
      }
      await db.annotations.bulkAdd([newAnnotation]);
    });

    // Soft-delete the original selection OUTSIDE the transaction above —
    // useDeleteAnnotations runs its own transaction with extra tables
    // (cuts cleanup, listing sortedAnnotationIds sync) which we can't
    // safely nest.
    await deleteAnnotations(deleteIds);

    dispatch(triggerAnnotationsUpdate());

    return { addedCount: 1, deletedCount: deleteIds.length };
  };
}
