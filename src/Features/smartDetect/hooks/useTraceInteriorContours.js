import { useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

import db from "App/db/db";
import computeInteriorContourPolygons from "Features/smartDetect/services/computeInteriorContourPolygons";

const SNAP_TOLERANCE_PX = 1;

export default function useTraceInteriorContours() {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();

  const trace = useCallback(
    async ({ annotations, annotationTemplate }) => {
      if (!annotations?.length || !annotationTemplate) {
        throw new Error("annotations and annotationTemplate are required");
      }

      const imageSize = baseMap?.getImageSize?.();
      const { width, height } = imageSize ?? {};
      if (!width || !height) throw new Error("No image size available");

      const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
      if (!meterByPx || meterByPx <= 0) throw new Error("meterByPx is required");

      // Resolve point coordinates (px), preserving original point IDs so
      // generated POLYGON walls can share vertices with the source polygons.
      const allPointIds = [];
      for (const ann of annotations) {
        if (ann.points) for (const p of ann.points) if (p.id) allPointIds.push(p.id);
        if (ann.cuts) {
          for (const cut of ann.cuts) {
            if (cut.points) for (const p of cut.points) if (p.id) allPointIds.push(p.id);
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
            pts.push({ x: record.x * width, y: record.y * height, id: p.id });
          } else if (p.x !== undefined && p.y !== undefined) {
            pts.push({ x: p.x, y: p.y });
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
        console.warn("[useTraceInteriorContours] need at least 1 POLYGON annotation");
        return { count: 0 };
      }

      const wallPolygons = computeInteriorContourPolygons({
        polygons: sourcePolygons,
        meterByPx,
      });
      if (!wallPolygons?.length) {
        console.warn("[useTraceInteriorContours] no interior contour polygons found");
        return { count: 0 };
      }

      // Collect projection points (no sourcePointId) into a dedup snap-map,
      // so coincident projections at T/+ junctions share a single point ID.
      const projPointIdByKey = new Map();
      const newPointRecords = [];
      const coordKey = (x, y) =>
        `${Math.round(x / SNAP_TOLERANCE_PX)},${Math.round(y / SNAP_TOLERANCE_PX)}`;

      const templateProps = getAnnotationTemplateProps(annotationTemplate);

      // Resolve the listing the new POLYGONs should belong to: the TEMPLATE's
      // listing (so the legend groups under "Mur plein" or whatever was picked),
      // not the redux-selected one. Fall back to selected listing if missing.
      const targetListingId = annotationTemplate.listingId ?? listingId;
      const targetListing = targetListingId
        ? await db.listings.get(targetListingId)
        : null;
      const entityTable =
        targetListing?.table ?? targetListing?.entityModel?.defaultTable;

      // Build the [{id, type}] point ref list for each wall polygon, allocating
      // new db.points records for projection vertices on the fly.
      const wallPointRefsList = wallPolygons.map((wall) =>
        wall.pointsPx.map((pt) => {
          if (pt.sourcePointId) return { id: pt.sourcePointId, type: "square" };
          const key = coordKey(pt.x, pt.y);
          let id = projPointIdByKey.get(key);
          if (!id) {
            id = nanoid();
            projPointIdByKey.set(key, id);
            newPointRecords.push({
              id,
              x: pt.x / width,
              y: pt.y / height,
              baseMapId,
              projectId,
              listingId: targetListingId,
            });
          }
          return { id, type: "square" };
        })
      );

      // 1. Write all projection points to db.points in one batch.
      if (newPointRecords.length > 0) {
        await db.points.bulkAdd(newPointRecords);
      }

      // 2. For each wall polygon, create entity (if listing has a table) +
      //    annotation via the canonical hooks, which handle audit fields,
      //    relAnnotationMappingCategory, and Redux triggers.
      const createdAnnotations = [];
      for (let i = 0; i < wallPolygons.length; i++) {
        const points = wallPointRefsList[i];
        if (!points || points.length < 3) continue;

        const annotation = {
          id: nanoid(),
          type: "POLYGON",
          annotationTemplateId: annotationTemplate.id,
          fillColor: templateProps.fillColor,
          fillType: templateProps.fillType ?? "SOLID",
          fillOpacity: templateProps.fillOpacity ?? 0.8,
          strokeColor: templateProps.strokeColor,
          strokeType: templateProps.strokeType ?? "SOLID",
          strokeOpacity: templateProps.strokeOpacity ?? 1,
          strokeWidth: templateProps.strokeWidth,
          strokeWidthUnit: templateProps.strokeWidthUnit ?? "PX",
          closeLine: true,
          baseMapId,
          listingId: targetListingId,
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
          points,
        };

        let entityId;
        if (entityTable && targetListing) {
          const entity = await createEntity({}, { listing: targetListing });
          entityId = entity?.id;
        }
        const created = await createAnnotation(annotation, { entityId });
        if (created) createdAnnotations.push(created);
      }

      console.log(
        `[useTraceInteriorContours] Created ${createdAnnotations.length} POLYGON annotations, ${newPointRecords.length} new points`
      );

      return { count: createdAnnotations.length, polygonAnnotations: createdAnnotations };
    },
    [baseMap, baseMapId, projectId, listingId, activeLayerId, createEntity, createAnnotation]
  );

  return trace;
}
