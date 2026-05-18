import { useCallback } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

import db from "App/db/db";
import computeWallPolylinesFromPolygonSegments from "Features/geometry/utils/computeWallPolylinesFromPolygonSegments";

const SNAP_TOLERANCE_PX = 1;

export default function useVectoriseWallsAsPolylines() {
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();

  const vectorise = useCallback(
    async ({ annotations, annotationTemplate }) => {
      if (!annotations?.length || !annotationTemplate) {
        throw new Error("annotations and annotationTemplate are required");
      }

      const imageSize = baseMap?.getImageSize?.();
      const { width, height } = imageSize ?? {};
      if (!width || !height) throw new Error("No image size available");

      const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
      if (!meterByPx || meterByPx <= 0) throw new Error("meterByPx is required");

      // Resolve point coordinates (px). `type` is preserved from the annotation
      // point ref so expandArcsInPath can detect S-C-S arc points.
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
            pts.push({ x: record.x * width, y: record.y * height, id: p.id, type: p.type });
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

      // Dedup coincident midline vertices so junctions share a single point ID.
      const projPointIdByKey = new Map();
      const newPointRecords = [];
      const coordKey = (x, y) =>
        `${Math.round(x / SNAP_TOLERANCE_PX)},${Math.round(y / SNAP_TOLERANCE_PX)}`;

      const templateProps = getAnnotationTemplateProps(annotationTemplate);

      const targetListingId = annotationTemplate.listingId ?? listingId;
      const targetListing = targetListingId
        ? await db.listings.get(targetListingId)
        : null;
      const entityTable =
        targetListing?.table ?? targetListing?.entityModel?.defaultTable;

      const wallPointRefsList = walls.map((wall) =>
        wall.pointsPx.map((pt) => {
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

      if (newPointRecords.length > 0) {
        await db.points.bulkAdd(newPointRecords);
      }

      const createdAnnotations = [];
      for (let i = 0; i < walls.length; i++) {
        const points = wallPointRefsList[i];
        if (!points || points.length < 2) continue;

        const thicknessCm =
          Math.round(walls[i].thicknessPx * meterByPx * 100 * 10) / 10;

        const annotation = {
          id: nanoid(),
          type: "POLYLINE",
          annotationTemplateId: annotationTemplate.id,
          strokeColor: templateProps.strokeColor,
          strokeType: templateProps.strokeType ?? "SOLID",
          strokeOpacity: templateProps.strokeOpacity ?? 1,
          strokeWidth: thicknessCm,
          strokeWidthUnit: "CM",
          closeLine: false,
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
        `[useVectoriseWallsAsPolylines] Created ${createdAnnotations.length} POLYLINE annotations, ${newPointRecords.length} new points`
      );

      return {
        count: createdAnnotations.length,
        polylineAnnotations: createdAnnotations,
      };
    },
    [baseMap, baseMapId, projectId, listingId, activeLayerId, createEntity, createAnnotation]
  );

  return vectorise;
}
