import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

import db from "App/db/db";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

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

export default function useConvertAnnotationsToPolyline() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ annotations, annotationTemplateId, keepCuts, explodeSegments }) => {
    const template = await db.annotationTemplates.get(annotationTemplateId);
    if (!template) return;

    const templateProps = getAnnotationTemplateProps(template);
    const listingId = template.listingId;

    const rawMappingCategories = template.mappingCategories ?? [];
    const mappingCategories = rawMappingCategories
      .map(parseMappingCategory)
      .filter(Boolean);

    const newAnnotations = [];
    const allMappingRels = [];
    const annotationIdsToDelete = [];

    for (const annotation of annotations) {
      if (annotation.type !== "POLYGON") continue;
      if (!annotation?.points?.length || annotation.points.length < 2) continue;

      if (explodeSegments) {
        // Explode: create one POLYLINE per segment, then delete original
        const rings = [];
        rings.push({ points: annotation.points, closed: true });

        if (keepCuts && Array.isArray(annotation.cuts)) {
          for (const cut of annotation.cuts) {
            if (cut.points?.length >= 2) {
              rings.push({ points: cut.points, closed: true });
            }
          }
        }

        for (const ring of rings) {
          const pts = ring.points;
          const n = pts.length;
          const segmentCount = ring.closed ? n : n - 1;

          for (let i = 0; i < segmentCount; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const id = nanoid();

            newAnnotations.push({
              ...templateProps,
              id,
              type: "POLYLINE",
              annotationTemplateId,
              annotationTemplateProps: { label: template.label },
              listingId,
              projectId,
              baseMapId: annotation.baseMapId,
              points: [{ id: p1.id }, { id: p2.id }],
              closeLine: false,
              ...(activeLayerId ? { layerId: activeLayerId } : {}),
            });

            for (const mc of mappingCategories) {
              allMappingRels.push({
                id: nanoid(),
                annotationId: id,
                projectId,
                nomenclatureKey: mc.nomenclatureKey,
                categoryKey: mc.categoryKey,
                source: "annotationTemplate",
              });
            }
          }
        }

        annotationIdsToDelete.push(annotation.id);
      } else {
        // In-place update: convert the annotation directly
        const updateData = {
          id: annotation.id,
          ...templateProps,
          type: "POLYLINE",
          annotationTemplateId,
          annotationTemplateProps: { label: template.label },
          listingId,
          closeLine: false,
          ...(activeLayerId ? { layerId: activeLayerId } : {}),
        };

        // Remove cuts from the annotation
        if (!keepCuts) {
          updateData.cuts = undefined;
        }

        await db.annotations.update(annotation.id, updateData);

        // Sync mapping categories (delete old template rels, add new ones)
        try {
          const existingRels = await db.relAnnotationMappingCategory
            .where("annotationId")
            .equals(annotation.id)
            .toArray();
          const templateRelIds = existingRels
            .filter((r) => r.source === "annotationTemplate")
            .map((r) => r.id);
          if (templateRelIds.length > 0) {
            await db.relAnnotationMappingCategory.bulkDelete(templateRelIds);
          }
          const newRels = mappingCategories.map((mc) => ({
            id: nanoid(),
            annotationId: annotation.id,
            projectId,
            nomenclatureKey: mc.nomenclatureKey,
            categoryKey: mc.categoryKey,
            source: "annotationTemplate",
          }));
          if (newRels.length > 0) {
            await db.relAnnotationMappingCategory.bulkAdd(newRels);
          }
        } catch (err) {
          console.warn("[useConvertAnnotationsToPolyline] mapping category sync error:", err);
        }

        // If keepCuts, create separate POLYLINE annotations from cuts
        if (keepCuts && Array.isArray(annotation.cuts)) {
          // Clear cuts from the converted annotation
          await db.annotations.update(annotation.id, { cuts: undefined });

          for (const cut of annotation.cuts) {
            if (!cut.points?.length || cut.points.length < 2) continue;
            const id = nanoid();

            newAnnotations.push({
              ...templateProps,
              id,
              type: "POLYLINE",
              annotationTemplateId,
              annotationTemplateProps: { label: template.label },
              listingId,
              projectId,
              baseMapId: annotation.baseMapId,
              points: cut.points,
              closeLine: false,
              ...(activeLayerId ? { layerId: activeLayerId } : {}),
            });

            for (const mc of mappingCategories) {
              allMappingRels.push({
                id: nanoid(),
                annotationId: id,
                projectId,
                nomenclatureKey: mc.nomenclatureKey,
                categoryKey: mc.categoryKey,
                source: "annotationTemplate",
              });
            }
          }
        }
      }
    }

    // Bulk create new annotations (from cuts or explode)
    if (newAnnotations.length > 0) {
      await db.annotations.bulkAdd(newAnnotations);
    }
    if (allMappingRels.length > 0) {
      await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
    }

    // Soft-delete originals when exploding
    for (const id of annotationIdsToDelete) {
      await db.annotations.delete(id);
    }

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
