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

export default function useSplitAnnotationsInSegments() {
  const dispatch = useDispatch();
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ annotations, annotationTemplateId }) => {
    const template = await db.annotationTemplates.get(annotationTemplateId);
    if (!template) return [];

    const templateProps = getAnnotationTemplateProps(template);
    const listingId = template.listingId;

    // Prepare mapping categories from template
    const rawMappingCategories = template.mappingCategories ?? [];
    const mappingCategories = rawMappingCategories
      .map(parseMappingCategory)
      .filter(Boolean);

    const allAnnotations = [];
    const allMappingRels = [];

    for (const annotation of annotations) {
      if (!annotation?.points?.length || annotation.points.length < 2) continue;

      // Collect rings to split
      const rings = [];
      const isClosed =
        annotation.type === "POLYGON" || annotation.closeLine === true;
      rings.push({ points: annotation.points, closed: isClosed });

      // Polygon cuts are always closed rings
      if (annotation.type === "POLYGON" && Array.isArray(annotation.cuts)) {
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

          const segAnnotation = {
            ...templateProps,
            id,
            type: "POLYLINE",
            annotationTemplateId,
            annotationTemplateProps: { label: template.label },
            listingId,
            projectId,
            baseMapId: annotation.baseMapId,
            points: [{ id: p1.id }, { id: p2.id }],
            ...(activeLayerId ? { layerId: activeLayerId } : {}),
          };

          allAnnotations.push(segAnnotation);

          // Mapping categories for this segment
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

    // Bulk create all at once
    if (allAnnotations.length > 0) {
      await db.annotations.bulkAdd(allAnnotations);
    }
    if (allMappingRels.length > 0) {
      await db.relAnnotationMappingCategory.bulkAdd(allMappingRels);
    }

    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return allAnnotations;
  };
}
