import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import getAnnotationsWithResolvedPointsAsync from "../services/getAnnotationsWithResolvedPointsAsync";
import getSettingOutPoints from "../utils/getSettingOutPoints";

import db from "App/db/db";

// Distribute POINT annotations at a regular step ("calepinage") along the
// selected POLYLINE annotations. Points landing on an existing polyline vertex
// reuse its db.points id; intermediate positions mint a new normalized point.
export default function useCreateSettingOutAnnotations() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: userEmail } = useUserEmail();

  return async ({ annotations, annotationTemplateId, options }) => {
    // data

    const polylines = (annotations || []).filter((a) => a.type === "POLYLINE");
    if (polylines.length === 0) return [];

    const template = await db.annotationTemplates.get(annotationTemplateId);
    if (!template) return [];

    const {
      stepM = 1,
      considerHeight = true,
      considerAngle = true,
      considerExtremities = true,
    } = options ?? {};

    // resolve points to pixel space (+ baseMapMeterByPx / baseMapImageSize)

    const resolved = await getAnnotationsWithResolvedPointsAsync(
      polylines.map((a) => a.id)
    );

    // build all POINTs + new db.points in memory

    const newPoints = [];
    const newAnnotations = [];

    for (const polyline of resolved) {
      if (!(polyline?.points?.length >= 2)) continue;

      const { width, height } = polyline.baseMapImageSize ?? {};
      if (!width || !height) continue;

      const settingOutPoints = getSettingOutPoints({
        points: polyline.points,
        closeLine: polyline.closeLine,
        polylineOffsetZ: polyline.offsetZ ?? 0,
        polylineHeight: polyline.height ?? 0,
        meterByPx: polyline.baseMapMeterByPx,
        stepM,
        considerHeight,
        considerAngle,
        considerExtremities,
      });

      for (const sp of settingOutPoints) {
        let pointId = sp.pointId;

        // intermediate position: mint a new normalized point
        if (!pointId) {
          pointId = nanoid();
          newPoints.push({
            id: pointId,
            x: sp.x / width,
            y: sp.y / height,
            projectId,
            listingId: polyline.listingId,
            baseMapId: polyline.baseMapId,
          });
        }

        newAnnotations.push({
          id: nanoid(),
          type: "POINT",
          annotationTemplateId,
          annotationTemplateProps: { label: template?.label },
          listingId: template?.listingId,
          projectId,
          baseMapId: polyline.baseMapId,
          createdBy: userEmail,
          point: { id: pointId },
          fillColor: template?.fillColor,
          variant: template?.variant,
          size: template?.size,
          sizeUnit: template?.sizeUnit,
          height: sp.height,
          offsetZ: sp.offsetZ,
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
        });
      }
    }

    if (newAnnotations.length === 0) return [];

    // batch write in a single transaction

    await db.transaction("rw", [db.points, db.annotations], async () => {
      if (newPoints.length > 0) await db.points.bulkAdd(newPoints);
      await db.annotations.bulkAdd(newAnnotations);
    });

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerEntitiesTableUpdate("annotations"));

    return newAnnotations;
  };
}
