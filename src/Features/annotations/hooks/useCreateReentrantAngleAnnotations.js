import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import getAnnotationsWithResolvedPointsAsync from "../services/getAnnotationsWithResolvedPointsAsync";
import findReentrantAngles from "Features/geometry/utils/findReentrantAngles";

import db from "App/db/db";

export default function useCreateReentrantAngleAnnotations() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: userEmail } = useUserEmail();

  return async ({ annotations, annotationTemplateId }) => {
    // data

    const polylines = annotations.filter((a) => a.type === "POLYLINE");
    const polygons = annotations.filter((a) => a.type === "POLYGON");

    if (polylines.length === 0 || polygons.length === 0) return [];

    // resolve points to pixel coordinates

    const allIds = annotations.map((a) => a.id);
    const resolved = await getAnnotationsWithResolvedPointsAsync(allIds);

    const resolvedById = {};
    for (const a of resolved) resolvedById[a.id] = a;

    const resolvedPolylines = polylines
      .map((pl) => resolvedById[pl.id])
      .filter((r) => r?.points?.length >= 2);
    const resolvedPolygons = polygons
      .map((pg) => resolvedById[pg.id])
      .filter((r) => r?.points?.length >= 3);

    // find reentrant angles

    const reentrantAngles = findReentrantAngles({
      polylines: resolvedPolylines,
      polygons: resolvedPolygons,
    });

    if (reentrantAngles.length === 0) return [];

    // build all POINT annotations in memory

    const template = await db.annotationTemplates.get(annotationTemplateId);
    const annotation0 = resolved[0];

    const allAnnotations = [];
    for (const angle of reentrantAngles) {
      allAnnotations.push({
        id: nanoid(),
        type: "POINT",
        annotationTemplateId,
        annotationTemplateProps: {
          label: template?.label,
        },
        listingId: template?.listingId,
        projectId,
        createdBy: userEmail,
        point: { id: angle.pointId },
        baseMapId: annotation0.baseMapId,
        fillColor: template?.fillColor,
        variant: template?.variant,
        size: template?.size,
        sizeUnit: template?.sizeUnit,
        height: angle.height,
        ...(activeLayerId ? { layerId: activeLayerId } : {}),
      });
    }

    // build mapping category rels

    const rawCategories = template?.mappingCategories ?? [];
    const allMappingRels = [];
    for (const a of allAnnotations) {
      for (const entry of rawCategories) {
        if (typeof entry !== "string") continue;
        const parts = entry.split(":");
        if (parts.length !== 2) continue;
        allMappingRels.push({
          id: nanoid(),
          annotationId: a.id,
          projectId,
          nomenclatureKey: parts[0].trim(),
          categoryKey: parts[1].trim(),
          source: "annotationTemplate",
        });
      }
    }

    // batch write in single transaction

    await db.transaction(
      "rw",
      [db.annotations, db.relAnnotationMappingCategory],
      async () => {
        if (allAnnotations.length > 0) {
          await db.annotations.bulkAdd(allAnnotations);
        }
        if (allMappingRels.length > 0) {
          await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
        }
      }
    );

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
    dispatch(triggerEntitiesTableUpdate("annotations"));

    return allAnnotations;
  };
}
