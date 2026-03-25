import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

import getAnnotationsWithResolvedPointsAsync from "../services/getAnnotationsWithResolvedPointsAsync";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import mergeAllPolygons from "Features/geometry/utils/mergeAllPolygons";
import mergeTwoPolygons from "Features/geometry/utils/mergeTwoPolygons";
import extractBoundaryPolylines from "Features/geometry/utils/extractBoundaryPolylines";

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
 * Slightly expand a polygon outward from its centroid.
 * Returns a new polygon object (does not mutate the original).
 */
const EXPAND_EPSILON = 0.5; // pixels

function dilatePolygon(polygon) {
  const pts = polygon.points.map((p) => ({ ...p }));
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
  return { ...polygon, points: pts, _sourceStripId: polygon._sourceStripId };
}

/**
 * Group polygons into clusters of touching polygons.
 * Uses a three-pass approach:
 *   1. Merge without dilation (polygons that naturally overlap)
 *   2. Try dilating remaining polygons to merge with existing clusters
 *   3. Try merging remaining polygons among themselves (dilated)
 * Non-merging polygons keep their original (non-dilated) geometry.
 */
function clusterPolygons(polygons) {
  if (polygons.length === 0) return [];
  if (polygons.length === 1) {
    return [
      {
        mergedPolygon: polygons[0],
        stripIds: new Set([polygons[0]._sourceStripId]),
      },
    ];
  }

  // Pass 1: merge without dilation
  const result = mergeAllPolygons(polygons);
  if (!result?.mergedPolygon) return [];

  const remainingSet = new Set(result.remainingPool);
  const consumedStripIds = new Set();
  for (const poly of polygons) {
    if (!remainingSet.has(poly)) {
      consumedStripIds.add(poly._sourceStripId);
    }
  }

  const clusters = [
    { mergedPolygon: result.mergedPolygon, stripIds: consumedStripIds },
  ];

  let remaining = [...result.remainingPool];
  if (remaining.length === 0) return clusters;

  // Pass 2: try merging remaining polygons (dilated) into existing clusters
  const stillRemaining = [];
  for (const poly of remaining) {
    const dilated = dilatePolygon(poly);
    let merged = false;
    for (let i = 0; i < clusters.length; i++) {
      const mergeResult = mergeTwoPolygons(clusters[i].mergedPolygon, dilated);
      if (mergeResult) {
        clusters[i] = {
          mergedPolygon: mergeResult.mergedPolygon,
          stripIds: new Set([...clusters[i].stripIds, poly._sourceStripId]),
        };
        merged = true;
        break;
      }
    }
    if (!merged) stillRemaining.push(poly);
  }

  if (stillRemaining.length === 0) return clusters;

  // Pass 3: try merging remaining among themselves (dilated)
  const dilatedRemaining = stillRemaining.map(dilatePolygon);
  const subResult = mergeAllPolygons(dilatedRemaining);

  if (subResult?.mergedPolygon) {
    const subRemainingSet = new Set(subResult.remainingPool);
    const subConsumedIds = new Set();
    const subOriginals = [];
    for (let i = 0; i < dilatedRemaining.length; i++) {
      if (!subRemainingSet.has(dilatedRemaining[i])) {
        subConsumedIds.add(stillRemaining[i]._sourceStripId);
      } else {
        subOriginals.push(stillRemaining[i]);
      }
    }
    if (subConsumedIds.size > 0) {
      clusters.push({
        mergedPolygon: subResult.mergedPolygon,
        stripIds: subConsumedIds,
      });
    }
    // Non-merging polygons: each becomes its own cluster with original geometry
    for (const poly of subOriginals) {
      clusters.push({
        mergedPolygon: poly,
        stripIds: new Set([poly._sourceStripId]),
      });
    }
  } else {
    // Nothing merged: each remaining polygon is its own cluster (original geometry)
    for (const poly of stillRemaining) {
      clusters.push({
        mergedPolygon: poly,
        stripIds: new Set([poly._sourceStripId]),
      });
    }
  }

  return clusters;
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
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ annotations, annotationTemplateId }) => {
    const meterByPx = baseMap?.meterByPx;

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
          poly._sourceStripId = strip.id;
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
            stripAnnotationId: strip.id,
          });
        }
      }
    }

    if (allStripPolygons.length === 0) return [];

    // 5. Cluster strip polygons into groups of touching polygons
    const clusters = clusterPolygons(allStripPolygons);
    if (clusters.length === 0) return [];

    // 6. Extract boundary polylines for each cluster
    const boundaryPolylines = [];
    for (const cluster of clusters) {
      const clusterConnections = connections.filter((c) =>
        cluster.stripIds.has(c.stripAnnotationId)
      );
      boundaryPolylines.push(
        ...extractBoundaryPolylines(cluster.mergedPolygon, clusterConnections)
      );
    }

    if (boundaryPolylines.length === 0) return [];

    // When no polylines are present, boundary contours are closed loops
    const closeLine = connections.length === 0;

    // 7. Build all DB records in memory
    const annotation0 = resolvedById[strips[0].id];
    const { width, height } = annotation0.baseMapImageSize || {
      width: 1,
      height: 1,
    };
    const template = await db.annotationTemplates.get(annotationTemplateId);
    const templateProps = getAnnotationTemplateProps(template);

    const rawMappingCategories = template?.mappingCategories ?? [];
    const mappingCategories = rawMappingCategories
      .map(parseMappingCategory)
      .filter(Boolean);

    const allNewPoints = [];
    const allNewAnnotations = [];
    const allMappingRels = [];
    const blueDotsByPolyline = new Map();

    for (const polylinePoints of boundaryPolylines) {
      if (polylinePoints.length < 2) continue;

      const dbPointRefs = [];
      const annotationId = nanoid();

      for (const p of polylinePoints) {
        if (p.isExistingPoint) {
          dbPointRefs.push({ id: p.id });
        } else {
          const pointId = p.id || nanoid();
          allNewPoints.push({
            id: pointId,
            x: p.x / width,
            y: p.y / height,
            projectId: annotation0.projectId,
            baseMapId: annotation0.baseMapId,
          });
          dbPointRefs.push({ id: pointId });

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

      allNewAnnotations.push({
        ...templateProps,
        id: annotationId,
        type: "POLYLINE",
        annotationTemplateId,
        annotationTemplateProps: { label: template?.label },
        listingId: template?.listingId,
        projectId: projectId ?? annotation0.projectId,
        baseMapId: annotation0.baseMapId,
        points: dbPointRefs,
        ...(closeLine && { closeLine: true }),
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      });

      for (const mc of mappingCategories) {
        allMappingRels.push({
          id: nanoid(),
          annotationId,
          projectId: projectId ?? annotation0.projectId,
          nomenclatureKey: mc.nomenclatureKey,
          categoryKey: mc.categoryKey,
          source: "annotationTemplate",
        });
      }
    }

    // 8. Prepare blue dot updates for existing polylines
    const polylineUpdates = [];
    for (const [polylineAnnotationId, blueDots] of blueDotsByPolyline) {
      const polylineAnnotation = await db.annotations.get(polylineAnnotationId);
      if (!polylineAnnotation?.points) continue;

      const updatedPoints = [...polylineAnnotation.points];

      const dotsWithPos = blueDots
        .map((dot) => {
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

      polylineUpdates.push({ id: polylineAnnotationId, points: updatedPoints });
    }

    // 9. Single transaction for all DB writes
    const tables = [db.points, db.annotations];
    if (allMappingRels.length > 0) tables.push(db.relAnnotationMappingCategory);

    await db.transaction("rw", tables, async () => {
      if (allNewPoints.length > 0) await db.points.bulkAdd(allNewPoints);
      if (allNewAnnotations.length > 0)
        await db.annotations.bulkAdd(allNewAnnotations);
      if (allMappingRels.length > 0)
        await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
      for (const upd of polylineUpdates) {
        await db.annotations.update(upd.id, { points: upd.points });
      }
    });

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
    return allNewAnnotations;
  };
}
