import { useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

import db from "App/db/db";
import cv from "Features/opencv/services/opencvService";

export default function useVectorisation() {
  const dispatch = useDispatch();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const orthoSnapAngleOffset = useSelector(
    (s) => s.mapEditor.orthoSnapAngleOffset
  );

  const baseMap = useMainBaseMap();
  const { value: selectedListing } = useSelectedListing();

  const vectorise = useCallback(
    async ({ annotations, annotationTemplate, enableExteriorOrtho = true, enableExteriorClose = true, enableInterior = true }) => {
      if (!annotations?.length || !annotationTemplate) {
        throw new Error("annotations and annotationTemplate are required");
      }

      const imageSize = baseMap?.getImageSize?.();
      const { width, height } = imageSize ?? {};
      if (!width || !height) throw new Error("No image size available");

      const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
      if (!meterByPx || meterByPx <= 0) throw new Error("meterByPx is required");

      const imageUrl = baseMap?.getUrl?.();
      if (!imageUrl) throw new Error("No baseMap image URL available");

      // Version transform: the active image may be scaled/offset from the reference
      const versionTransform = baseMap?.getActiveVersionTransform?.() || { x: 0, y: 0, scale: 1 };
      const vScale = versionTransform.scale || 1;
      const vOffX = versionTransform.x || 0;
      const vOffY = versionTransform.y || 0;

      // ── 1. Resolve points (main + cuts) from DB ──────────────────────
      const allPointIds = [];
      for (const ann of annotations) {
        if (ann.points) for (const p of ann.points) if (p.id) allPointIds.push(p.id);
        if (ann.cuts) for (const cut of ann.cuts) if (cut.points) for (const p of cut.points) if (p.id) allPointIds.push(p.id);
      }

      const pointRecords = await db.points.bulkGet(allPointIds);
      const pointsById = {};
      for (const pt of pointRecords) if (pt) pointsById[pt.id] = pt;

      const resolvePointList = (pointRefs) => {
        const pts = [];
        for (const p of pointRefs) {
          const record = pointsById[p.id];
          if (record) pts.push({ x: record.x * width, y: record.y * height });
          else if (p.x !== undefined && p.y !== undefined) pts.push({ x: p.x, y: p.y });
        }
        return pts;
      };

      const boundaries = [];
      for (const ann of annotations) {
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
        boundaries.push({ points: pts, cuts });
      }

      if (boundaries.length === 0) throw new Error("No valid polygon boundaries found");

      // ── 2. Transform boundaries from reference space to version image space ─
      const refToVersion = (pt) => ({
        x: (pt.x - vOffX) / vScale,
        y: (pt.y - vOffY) / vScale,
      });
      const versionBoundaries = boundaries.map((b) => ({
        points: b.points.map(refToVersion),
        cuts: b.cuts.map((c) => ({ points: c.points.map(refToVersion) })),
      }));

      // meterByPx is in reference space — adjust for version scale
      const versionMeterByPx = meterByPx / vScale;

      await cv.load();
      const result = await cv.vectoriseWallsAsync({
        imageUrl,
        boundaries: versionBoundaries,
        offsetAngle: orthoSnapAngleOffset || 0,
        meterByPx: versionMeterByPx,
        enableExteriorOrtho,
        enableExteriorClose,
        enableInterior,
      });

      // Transform results back from version image space to reference space
      const { thicknesses, periCount = 0 } = result;
      const polylines = result.polylines.map((pl) =>
        pl.map((p) => ({ x: p.x * vScale + vOffX, y: p.y * vScale + vOffY }))
      );
      if (!polylines?.length) {
        console.warn("[useVectorisation] No walls detected");
        return { count: 0 };
      }

      // ── 3. Build annotations with shared point topology ───────────────
      const templateProps = getAnnotationTemplateProps(annotationTemplate);
      const entityTable = selectedListing?.table ?? selectedListing?.entityModel?.defaultTable;

      const SNAP_TOLERANCE = 3;
      const pointIndex = new Map();
      const coordKey = (x, y) => `${Math.round(x / SNAP_TOLERANCE)},${Math.round(y / SNAP_TOLERANCE)}`;
      const getOrCreatePoint = (pxX, pxY) => {
        const key = coordKey(pxX, pxY);
        if (pointIndex.has(key)) return pointIndex.get(key).id;
        const pointId = nanoid();
        pointIndex.set(key, { id: pointId, nx: pxX / width, ny: pxY / height });
        return pointId;
      };

      const allAnnotations = [];
      const allEntities = [];

      for (let i = 0; i < polylines.length; i++) {
        const polyline = polylines[i];
        if (!polyline || polyline.length < 2) continue;

        const thicknessPx = thicknesses[i] ?? 2;
        const thicknessCm = Math.round(thicknessPx * versionMeterByPx * 100 * 10) / 10;

        let entityId;
        if (entityTable) {
          entityId = nanoid();
          allEntities.push({ id: entityId, listingId, projectId });
        }

        const pointRefs = polyline.map((pt) => ({
          id: getOrCreatePoint(pt.x, pt.y),
          type: "square",
        }));

        allAnnotations.push({
          id: nanoid(),
          type: "POLYLINE",
          annotationTemplateId: annotationTemplate.id,
          strokeColor: templateProps.strokeColor,
          strokeType: templateProps.strokeType ?? "SOLID",
          strokeOpacity: templateProps.strokeOpacity ?? 1,
          strokeWidth: thicknessCm,
          strokeWidthUnit: "CM",
          closeLine: false,
          entityId,
          baseMapId,
          projectId,
          listingId,
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
          topologySide: i < periCount ? "EXT" : "INT",
          points: pointRefs,
        });
      }

      // ── 4. Bulk write ────────────────────────────────────────────────
      const allPoints = [];
      for (const entry of pointIndex.values()) {
        allPoints.push({
          id: entry.id, x: entry.nx, y: entry.ny,
          baseMapId, projectId, listingId, forMarker: false,
        });
      }

      const tables = [db.points, db.annotations];
      if (entityTable && allEntities.length > 0) tables.push(db[entityTable]);

      await db.transaction("rw", tables, async () => {
        if (allPoints.length > 0) await db.points.bulkAdd(allPoints);
        if (entityTable && allEntities.length > 0) await db[entityTable].bulkAdd(allEntities);
        if (allAnnotations.length > 0) await db.annotations.bulkAdd(allAnnotations);
      });

      dispatch(triggerAnnotationsUpdate());
      if (entityTable) dispatch(triggerEntitiesTableUpdate(entityTable));

      console.log(`[useVectorisation] Created ${allAnnotations.length} annotations, ${allPoints.length} points`);

      // Build wall annotations with resolved pixel coordinates for boundary computation
      const pointById = new Map();
      for (const [, v] of pointIndex) pointById.set(v.id, v);
      const wallAnnotations = allAnnotations.map((ann) => ({
        ...ann,
        points: ann.points.map((pRef) => {
          const entry = pointById.get(pRef.id);
          if (entry) return { ...pRef, x: entry.nx * width, y: entry.ny * height };
          return pRef;
        }),
      }));

      return { count: allAnnotations.length, wallAnnotations };
    },
    [baseMap, baseMapId, projectId, listingId, activeLayerId, orthoSnapAngleOffset, selectedListing, dispatch]
  );

  return vectorise;
}
