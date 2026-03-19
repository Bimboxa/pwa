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
            sharedPointId: pt.id,
            offsetCoord,
            polylineAnnotationId: polyline.id,
            polylineCoords: polyline.points.map((p) => ({
              x: p.x,
              y: p.y,
              id: p.id,
            })),
          });
        }
      }
    }

    if (allStripPolygons.length === 0) return [];

    // 4b. Slightly expand each polygon to ensure overlap at T-junctions
    // (when a strip starts from a point on another strip's centerline,
    // polygons may only touch at a point/edge — expansion fixes this)
    const EXPAND_EPSILON = 1.5; // pixels
    for (const poly of allStripPolygons) {
      const pts = poly.points;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      for (const p of pts) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0) {
          const scale = (d + EXPAND_EPSILON) / d;
          p.x = cx + dx * scale;
          p.y = cy + dy * scale;
        }
      }
    }

    // 5. Merge all strip polygons
    const mergeResult = mergeAllPolygons(allStripPolygons);
    if (!mergeResult?.mergedPolygon) return [];

    // 6. Extract boundary polylines
    const boundaryPolylines = extractBoundaryPolylines(
      mergeResult.mergedPolygon,
      connections
    );

    if (boundaryPolylines.length === 0) return [];

    // When no polylines are present, boundary contours are closed loops
    const closeLine = connections.length === 0;

    // 7. Create annotations for each boundary polyline
    const annotation0 = resolvedById[strips[0].id];
    const template = await db.annotationTemplates.get(annotationTemplateId);
    const createdAnnotations = [];

    // Collect blue dots to insert into existing polylines
    // Map: polylineAnnotationId → [{ pointId, segmentIndex, x, y }]
    const blueDotsByPolyline = new Map();

    for (const polylinePoints of boundaryPolylines) {
      if (polylinePoints.length < 2) continue;

      const newPointsToCreate = [];
      const dbPointRefs = [];

      for (const p of polylinePoints) {
        if (p.isExistingPoint) {
          // Reuse existing point (shared red dot) — no db creation needed
          dbPointRefs.push({ id: p.id });
        } else {
          // New point to create
          const pointId = p.id || nanoid();
          newPointsToCreate.push({
            id: pointId,
            x: p.x / width,
            y: p.y / height,
            projectId: annotation0.projectId,
            baseMapId: annotation0.baseMapId,
          });
          dbPointRefs.push({ id: pointId });

          // Track blue dots for polyline insertion
          if (p.isProjection && p.polylineAnnotationId != null) {
            if (!blueDotsByPolyline.has(p.polylineAnnotationId)) {
              blueDotsByPolyline.set(p.polylineAnnotationId, []);
            }
            blueDotsByPolyline.get(p.polylineAnnotationId).push({
              pointId,
              segmentStartId: p.segmentStartId,
              segmentEndId: p.segmentEndId,
              t: p.t,
            });
          }
        }
      }

      if (newPointsToCreate.length > 0) {
        await db.points.bulkAdd(newPointsToCreate);
      }

      const newAnnotation = await createAnnotation({
        type: "POLYLINE",
        annotationTemplateId,
        annotationTemplateProps: {
          label: template?.label,
        },
        points: dbPointRefs,
        baseMapId: annotation0.baseMapId,
        strokeColor: template?.strokeColor,
        strokeWidth: template?.strokeWidth,
        strokeWidthUnit: template?.strokeWidthUnit,
        strokeOpacity: template?.strokeOpacity,
        strokeType: template?.strokeType,
        ...(closeLine && { closeLine: true }),
      });

      if (newAnnotation) createdAnnotations.push(newAnnotation);
    }

    // 8. Insert blue dots into existing polyline annotations
    for (const [polylineAnnotationId, blueDots] of blueDotsByPolyline) {
      const polylineAnnotation = await db.annotations.get(polylineAnnotationId);
      if (!polylineAnnotation?.points) continue;

      const updatedPoints = [...polylineAnnotation.points];

      // Process in reverse order of found position to avoid index shift issues
      const dotsWithPos = blueDots
        .map((dot) => {
          // Find the segment by matching the two consecutive point IDs
          for (let i = 0; i < updatedPoints.length - 1; i++) {
            if (
              updatedPoints[i].id === dot.segmentStartId &&
              updatedPoints[i + 1].id === dot.segmentEndId
            ) {
              return { ...dot, insertAt: i + 1 };
            }
          }
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => b.insertAt - a.insertAt || b.t - a.t);

      for (const dot of dotsWithPos) {
        updatedPoints.splice(dot.insertAt, 0, { id: dot.pointId });
      }

      await db.annotations.update(polylineAnnotationId, {
        points: updatedPoints,
      });
    }

    dispatch(triggerAnnotationsUpdate());
    return createdAnnotations;
  };
}
