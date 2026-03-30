import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useMainBaseMap from "./useMainBaseMap";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import getPolygonsPointsFromStripAnnotation from "Features/annotations/utils/getPolygonsPointsFromStripAnnotation";

import db from "App/db/db";

// Compute signed area to determine polygon winding order.
// Positive = counter-clockwise, negative = clockwise.
function getSignedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

export default function useCloneAnnotationsAndEntities() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const { value: userEmail } = useUserEmail();
  const { value: selectedListing } = useSelectedListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const _newAnnotation = useSelector(
    (state) => state.annotations.newAnnotation
  );
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

  return async (annotations, options) => {
    if (!annotations || annotations.length === 0) return [];

    let newAnnotation = options?.newAnnotation;
    if (!newAnnotation) newAnnotation = _newAnnotation;

    const entityLabel = options?.entityLabel;
    const entityTable =
      selectedListing?.table ?? selectedListing?.entityModel?.defaultTable;

    // 1. Prepare all items in memory
    const allEntities = [];
    const allAnnotations = [];

    for (const annotation of annotations) {
      const isPolygonToPolyline =
        annotation.type === "POLYGON" && newAnnotation.type === "POLYLINE";
      const hasCuts =
        Array.isArray(annotation.cuts) && annotation.cuts.length > 0;
      const shouldSplitIntoMultiple = isPolygonToPolyline && hasCuts;

      const isStripToPolygon =
        annotation.type === "STRIP" && newAnnotation.type === "POLYGON";

      const isToStrip =
        newAnnotation.type === "STRIP" && annotation.type !== "STRIP";

      const itemsToCreate = [];

      if (shouldSplitIntoMultiple) {
        itemsToCreate.push({ points: annotation.points, cuts: [] });
        annotation.cuts.forEach((cut) => {
          if (cut.points && cut.points.length > 0) {
            itemsToCreate.push({ points: cut.points, cuts: [] });
          }
        });
      } else if (isStripToPolygon) {
        const polygonsPoints = getPolygonsPointsFromStripAnnotation(
          annotation,
          baseMap.meterByPx
        );
        polygonsPoints.forEach((points) => {
          itemsToCreate.push({ points, cuts: [] });
        });
      } else {
        itemsToCreate.push({
          points: annotation.points,
          cuts: annotation.cuts,
        });
      }

      for (const item of itemsToCreate) {
        const entityId = nanoid();
        const annotationId = nanoid();

        // Build entity record
        allEntities.push({
          id: entityId,
          createdBy: userEmail,
          listingId: newAnnotation.listingId || annotation.listingId,
          projectId: annotation.projectId,
          ...(entityLabel ? { label: entityLabel } : {}),
        });

        // Build annotation record
        const clonedAnnotation = {
          ...annotation,
          ...newAnnotation,
          id: annotationId,
          entityId,
          projectId,
          listingId: newAnnotation.listingId || annotation.listingId,
          points: item.points,
          cuts: item.cuts,
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
        };

        if (isPolygonToPolyline || isStripToPolygon) {
          clonedAnnotation.closeLine = true;
        }

        if (isToStrip) {
          clonedAnnotation.stripOrientation = 1;
          if (annotation.type === "POLYGON" || annotation.closeLine) {
            clonedAnnotation.closeLine = true;
            const signedArea = getSignedArea(item.points);
            clonedAnnotation.stripOrientation = signedArea >= 0 ? 1 : -1;
          }
        }

        allAnnotations.push(clonedAnnotation);
      }
    }

    // 2. Build mapping category rels from template (fetch template once per unique ID)
    const uniqueTemplateIds = [
      ...new Set(allAnnotations.map((a) => a.annotationTemplateId).filter(Boolean)),
    ];
    const templates =
      uniqueTemplateIds.length > 0
        ? await db.annotationTemplates.bulkGet(uniqueTemplateIds)
        : [];
    const templateById = new Map();
    for (const t of templates) {
      if (t) templateById.set(t.id, t);
    }

    const allMappingRels = [];
    for (const a of allAnnotations) {
      if (!a.annotationTemplateId || !projectId) continue;
      const template = templateById.get(a.annotationTemplateId);
      const rawCategories = template?.mappingCategories ?? [];
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

    // 3. Execute all writes in a single transaction
    const tables = [db.annotations, db.relAnnotationMappingCategory];
    if (entityTable && db[entityTable]) tables.push(db[entityTable]);

    await db.transaction("rw", tables, async () => {
      if (entityTable && allEntities.length > 0) {
        await db[entityTable].bulkAdd(allEntities);
      }
      if (allAnnotations.length > 0) {
        await db.annotations.bulkAdd(allAnnotations);
      }
      if (allMappingRels.length > 0) {
        await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
      }
    });

    // 4. Single Redux dispatches
    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
    if (entityTable) dispatch(triggerEntitiesTableUpdate(entityTable));

    return allAnnotations;
  };
}
