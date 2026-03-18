import { useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateAnnotation from "./useCreateAnnotation";

import getAnnotationsWithResolvedPointsAsync from "../services/getAnnotationsWithResolvedPointsAsync";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import mergeAllPolygons from "Features/geometry/utils/mergeAllPolygons";
import extractBoundaryPolylines from "Features/geometry/utils/extractBoundaryPolylines";
import projectPointOnSegment from "../utils/projectPointOnSegment";

import db from "App/db/db";

/**
 * Compute the offset point for a strip extremity (first or last centerline point).
 */
function computeOffsetForExtremity(points, extremityIndex, distance) {
  const n = points.length;
  let segStart, segEnd;

  if (extremityIndex === 0) {
    segStart = points[0];
    segEnd = points[1];
  } else {
    segStart = points[n - 2];
    segEnd = points[n - 1];
  }

  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: points[extremityIndex].x, y: points[extremityIndex].y };

  // Normal perpendicular to segment direction (same as getRawOffsetPolyline)
  const nx = -dy / len;
  const ny = dx / len;

  const p = points[extremityIndex];
  return {
    x: p.x + nx * distance,
    y: p.y + ny * distance,
  };
}

/**
 * Compute the offset distance for a strip annotation (same logic as getStripePolygons).
 */
function getStripOffsetDistance(annotation, baseMapMeterByPx) {
  const {
    strokeWidth = 20,
    strokeWidthUnit = "PX",
    stripOrientation = 1,
  } = annotation;

  const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;

  if (isCmUnit) {
    return ((strokeWidth * 0.01) / baseMapMeterByPx) * stripOrientation;
  }
  return strokeWidth * stripOrientation;
}

export default function useExtractStripBoundaries() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const createAnnotation = useCreateAnnotation();

  return async ({ annotations, annotationTemplateId }) => {
    const meterByPx = baseMap?.meterByPx;
    const { width, height } = baseMap?.image?.imageSize || {
      width: 1,
      height: 1,
    };

    // 1. Separate strips from polylines
    const strips = annotations.filter((a) => a.type === "STRIP");
    const polylines = annotations.filter((a) => a.type === "POLYLINE");

    if (strips.length === 0) return [];

    // 2. Resolve all annotation points (absolute coordinates)
    const allIds = annotations.map((a) => a.id);
    const resolved = await getAnnotationsWithResolvedPointsAsync(allIds);

    const resolvedById = {};
    for (const a of resolved) resolvedById[a.id] = a;

    // 3. Collect all polyline point IDs for shared-point detection
    const polylinePointIds = new Set();
    const polylineByPointId = new Map(); // pointId → resolved polyline annotation
    for (const pl of polylines) {
      const rpl = resolvedById[pl.id];
      if (!rpl?.points) continue;
      for (const p of rpl.points) {
        polylinePointIds.add(p.id);
        polylineByPointId.set(p.id, rpl);
      }
    }

    // 4. Convert all strips to polygons and collect connection info
    const allStripPolygons = [];
    const connections = []; // { sharedCoord, offsetCoord, polylineCoords }

    for (const strip of strips) {
      const rStrip = resolvedById[strip.id];
      if (!rStrip?.points || rStrip.points.length < 2) continue;

      // Get strip polygons (may be multiple if hidden segments)
      const polygons = getStripePolygons(rStrip, meterByPx, true);
      for (const poly of polygons) {
        if (poly?.points?.length >= 3) {
          allStripPolygons.push(poly);
        }
      }

      // Find shared extremities with polylines
      const distance = getStripOffsetDistance(rStrip, meterByPx);
      const firstPt = rStrip.points[0];
      const lastPt = rStrip.points[rStrip.points.length - 1];

      for (const [extIdx, pt] of [
        [0, firstPt],
        [rStrip.points.length - 1, lastPt],
      ]) {
        if (polylinePointIds.has(pt.id)) {
          const polyline = polylineByPointId.get(pt.id);
          if (!polyline?.points) continue;

          const offsetCoord = computeOffsetForExtremity(
            rStrip.points,
            extIdx,
            distance
          );

          connections.push({
            sharedCoord: { x: pt.x, y: pt.y },
            offsetCoord,
            polylineCoords: polyline.points.map((p) => ({ x: p.x, y: p.y })),
          });
        }
      }
    }

    if (allStripPolygons.length === 0) return [];

    // 5. Merge all strip polygons
    const mergeResult = mergeAllPolygons(allStripPolygons);
    if (!mergeResult?.mergedPolygon) return [];

    // 6. Extract boundary polylines
    const boundaryPolylines = extractBoundaryPolylines(
      mergeResult.mergedPolygon,
      connections
    );

    if (boundaryPolylines.length === 0) return [];

    // 7. Create annotations for each boundary polyline
    const annotation0 = resolvedById[strips[0].id];
    const template = await db.annotationTemplates.get(annotationTemplateId);
    const createdAnnotations = [];

    for (const polylinePoints of boundaryPolylines) {
      if (polylinePoints.length < 2) continue;

      // Convert points to ratio coordinates and persist to db.points
      const dbPoints = polylinePoints.map((p) => ({
        id: p.id || nanoid(),
        x: p.x / width,
        y: p.y / height,
        projectId: annotation0.projectId,
        baseMapId: annotation0.baseMapId,
      }));

      await db.points.bulkAdd(dbPoints);

      const newAnnotation = await createAnnotation({
        type: "POLYLINE",
        annotationTemplateId,
        annotationTemplateProps: {
          label: template?.label,
        },
        points: dbPoints.map((p) => ({ id: p.id })),
        baseMapId: annotation0.baseMapId,
        strokeColor: template?.strokeColor,
        strokeWidth: template?.strokeWidth,
        strokeWidthUnit: template?.strokeWidthUnit,
        strokeOpacity: template?.strokeOpacity,
        strokeType: template?.strokeType,
      });

      if (newAnnotation) createdAnnotations.push(newAnnotation);
    }

    dispatch(triggerAnnotationsUpdate());
    return createdAnnotations;
  };
}
