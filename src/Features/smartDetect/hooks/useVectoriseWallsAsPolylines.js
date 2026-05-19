import { useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import insertWallJunctionPoints from "Features/geometry/utils/insertWallJunctionPoints";

import db from "App/db/db";
import computeWallPolylinesFromPolygonSegments from "Features/geometry/utils/computeWallPolylinesFromPolygonSegments";

// Junction "encastrement": segment endpoints within this many px collapse to
// a single shared point id (same rule as the smartDetect auto-detection,
// useVectorisation getOrCreatePoint).
const SNAP_TOLERANCE_PX = 3;

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

export default function useVectoriseWallsAsPolylines() {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const { value: userEmail } = useUserEmail();

  const vectorise = useCallback(
    async ({ annotations, annotationTemplate }) => {
      if (!annotations?.length || !annotationTemplate) {
        throw new Error("annotations and annotationTemplate are required");
      }

      const imageSize = baseMap?.getImageSize?.();
      const { width, height } = imageSize ?? {};
      if (!width || !height) throw new Error("No image size available");

      const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
      if (!meterByPx || meterByPx <= 0)
        throw new Error("meterByPx is required");

      // Resolve point coordinates (px). `type` is preserved from the annotation
      // point ref so expandArcsInPath can detect S-C-S arc points.
      const allPointIds = [];
      for (const ann of annotations) {
        if (ann.points)
          for (const p of ann.points) if (p.id) allPointIds.push(p.id);
        if (ann.cuts) {
          for (const cut of ann.cuts) {
            if (cut.points)
              for (const p of cut.points) if (p.id) allPointIds.push(p.id);
          }
        }
      }
      const pointRecords = await db.points.bulkGet(allPointIds);
      const pointsById = {};
      for (const pt of pointRecords) if (pt) pointsById[pt.id] = pt;

      const resolvePointList = (pointRefs) => {
        const pts = [];
        for (const p of pointRefs) {
          const record = pointsById[p.id];
          if (record) {
            pts.push({
              x: record.x * width,
              y: record.y * height,
              id: p.id,
              type: p.type,
            });
          } else if (p.x !== undefined && p.y !== undefined) {
            pts.push({ x: p.x, y: p.y, type: p.type });
          }
        }
        return pts;
      };

      const sourcePolygons = [];
      for (const ann of annotations) {
        if (ann.type !== "POLYGON") continue;
        if (!ann.points || ann.points.length < 3) continue;
        const pts = resolvePointList(ann.points);
        if (pts.length < 3) continue;
        const cuts = [];
        if (ann.cuts) {
          for (const cut of ann.cuts) {
            if (cut.points && cut.points.length >= 3) {
              const cutPts = resolvePointList(cut.points);
              if (cutPts.length >= 3) cuts.push({ points: cutPts });
            }
          }
        }
        sourcePolygons.push({ points: pts, cuts });
      }

      if (sourcePolygons.length < 1) {
        console.warn(
          "[useVectoriseWallsAsPolylines] need at least 1 POLYGON annotation"
        );
        return { count: 0 };
      }

      const walls = computeWallPolylinesFromPolygonSegments({
        polygons: sourcePolygons,
        meterByPx,
      });
      if (!walls?.length) {
        console.warn("[useVectoriseWallsAsPolylines] no wall polylines found");
        return { count: 0 };
      }

      const templateProps = getAnnotationTemplateProps(annotationTemplate);

      const targetListingId = annotationTemplate.listingId ?? listingId;
      const targetListing = targetListingId
        ? await db.listings.get(targetListingId)
        : null;
      const entityTable =
        targetListing?.table ?? targetListing?.entityModel?.defaultTable;

      const rawMappingCategories = annotationTemplate.mappingCategories ?? [];
      const mappingCategories = rawMappingCategories
        .map(parseMappingCategory)
        .filter(Boolean);

      // Split every wall into independent 2-point segments (points are cloned
      // so each segment can move on its own at a junction — two arms of one
      // L-shaped wall must NOT share the bend vertex object).
      const wallSegments = [];
      for (const wall of walls) {
        const pts = wall.pointsPx;
        if (!pts || pts.length < 2) continue;
        for (let s = 0; s + 1 < pts.length; s++) {
          const a = pts[s];
          const b = pts[s + 1];
          if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) continue;
          wallSegments.push({
            pointsPx: [
              { x: a.x, y: a.y },
              { x: b.x, y: b.y },
            ],
            thicknessPx: wall.thicknessPx,
          });
        }
      }

      // Junction post-pass on the 2-point segments. Every corner — a wall's
      // own 90° bend OR a junction between two different walls — is an L/T
      // between two segments: the longer one is "through" (extended to cover
      // the corner), the shorter is "abutting" (embedded 1 px). Endpoints are
      // never made coincident, so no two segments share a point at a corner.
      insertWallJunctionPoints({ walls: wallSegments });

      // Shared point topology: endpoints within SNAP_TOLERANCE_PX collapse to
      // a single point id, so segments stay joined at junctions — same
      // "encastrement" rule as the smartDetect auto-detection
      // (useVectorisation getOrCreatePoint). After the junction pass above,
      // cross-wall corner points share coordinates so they collapse here.
      const pointIdByKey = new Map();
      const newPointRecords = [];
      const coordKey = (x, y) =>
        `${Math.round(x / SNAP_TOLERANCE_PX)},${Math.round(y / SNAP_TOLERANCE_PX)}`;
      const getOrCreatePoint = (x, y) => {
        const key = coordKey(x, y);
        let id = pointIdByKey.get(key);
        if (!id) {
          id = nanoid();
          pointIdByKey.set(key, id);
          newPointRecords.push({
            id,
            x: x / width,
            y: y / height,
            baseMapId,
            projectId,
            listingId: targetListingId,
          });
        }
        return id;
      };

      const allEntities = [];
      const allAnnotations = [];
      const allMappingRels = [];

      // Emit each (junction-corrected) 2-point segment.
      for (const seg of wallSegments) {
        const p1 = seg.pointsPx?.[0];
        const p2 = seg.pointsPx?.[1];
        if (!p1 || !p2) continue;
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 1) continue;

        const thicknessCm =
          Math.round(seg.thicknessPx * meterByPx * 100 * 10) / 10;

        const id1 = getOrCreatePoint(p1.x, p1.y);
        const id2 = getOrCreatePoint(p2.x, p2.y);
        if (id1 === id2) continue;

        let entityId;
        if (entityTable && targetListing) {
          entityId = nanoid();
          allEntities.push({
            id: entityId,
            createdBy: userEmail,
            listingId: targetListingId,
            projectId: targetListing.projectId ?? projectId,
          });
        }

        const annotationId = nanoid();
        allAnnotations.push({
          id: annotationId,
          type: "POLYLINE",
          annotationTemplateId: annotationTemplate.id,
          strokeColor: templateProps.strokeColor,
          strokeType: templateProps.strokeType ?? "SOLID",
          strokeOpacity: templateProps.strokeOpacity ?? 1,
          strokeWidth: thicknessCm,
          strokeWidthUnit: "CM",
          closeLine: false,
          baseMapId,
          projectId,
          listingId: targetListingId,
          createdBy: userEmail,
          ...(entityId ? { entityId } : {}),
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
          points: [
            { id: id1, type: "square" },
            { id: id2, type: "square" },
          ],
        });

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

      if (allAnnotations.length === 0) {
        console.warn("[useVectoriseWallsAsPolylines] no annotations to create");
        return { count: 0 };
      }

      // Single batched write + one Redux refresh, so the annotations appear
      // all at once instead of one by one (same pattern as
      // useCreateAnnotationsFromDetectedStrips / useSplitAnnotationsInSegments).
      if (newPointRecords.length > 0) {
        await db.points.bulkAdd(newPointRecords);
      }
      if (entityTable && allEntities.length > 0) {
        await db[entityTable].bulkAdd(allEntities);
      }
      await db.annotations.bulkAdd(allAnnotations);
      if (allMappingRels.length > 0) {
        await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
      }

      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());
      dispatch(triggerEntitiesTableUpdate("annotations"));
      if (entityTable && allEntities.length > 0) {
        dispatch(triggerEntitiesTableUpdate(entityTable));
      }

      console.log(
        `[useVectoriseWallsAsPolylines] Created ${allAnnotations.length} POLYLINE annotations, ${allEntities.length} entities, ${newPointRecords.length} new points`
      );

      return {
        count: allAnnotations.length,
        polylineAnnotations: allAnnotations,
      };
    },
    [
      baseMap,
      baseMapId,
      projectId,
      listingId,
      activeLayerId,
      dispatch,
      userEmail,
    ]
  );

  return vectorise;
}
