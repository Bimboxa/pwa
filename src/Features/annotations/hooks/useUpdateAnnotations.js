import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

export default function useUpdateAnnotations() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (updatesArray) => {
    if (!updatesArray || updatesArray.length === 0) return;

    // Separate updates that change annotationTemplateId
    const templateChangeIds = [];
    const newTemplateIdSet = new Set();
    for (const u of updatesArray) {
      if (u.annotationTemplateId !== undefined) {
        templateChangeIds.push(u.id);
        if (u.annotationTemplateId) {
          newTemplateIdSet.add(u.annotationTemplateId);
        }
      }
    }

    await db.transaction(
      "rw",
      [db.annotations, db.relAnnotationMappingCategory, db.annotationTemplates],
      async () => {
        // 1. Batch annotation updates
        await Promise.all(
          updatesArray.map((u) => {
            const { id, ...fields } = u;
            return db.annotations.update(id, fields);
          })
        );

        // 2. Sync relAnnotationMappingCategory for template changes
        if (templateChangeIds.length > 0 && projectId) {
          // Delete old rels from annotationTemplate source (single query)
          const existingRels = await db.relAnnotationMappingCategory
            .where("annotationId")
            .anyOf(templateChangeIds)
            .toArray();

          const oldRelIds = existingRels
            .filter((r) => r.source === "annotationTemplate")
            .map((r) => r.id);

          if (oldRelIds.length > 0) {
            await db.relAnnotationMappingCategory.bulkDelete(oldRelIds);
          }

          // Fetch all new templates at once
          const uniqueNewTemplateIds = [...newTemplateIdSet];
          const newTemplates =
            uniqueNewTemplateIds.length > 0
              ? await db.annotationTemplates.bulkGet(uniqueNewTemplateIds)
              : [];

          const templateById = new Map();
          for (const t of newTemplates) {
            if (t) templateById.set(t.id, t);
          }

          // Build all new rels in memory
          const allNewRels = [];
          for (const u of updatesArray) {
            if (!u.annotationTemplateId) continue;
            const template = templateById.get(u.annotationTemplateId);
            const rawCategories = template?.mappingCategories ?? [];

            for (const entry of rawCategories) {
              if (typeof entry !== "string") continue;
              const parts = entry.split(":");
              if (parts.length !== 2) continue;
              allNewRels.push({
                id: nanoid(),
                annotationId: u.id,
                projectId,
                nomenclatureKey: parts[0].trim(),
                categoryKey: parts[1].trim(),
                source: "annotationTemplate",
              });
            }
          }

          if (allNewRels.length > 0) {
            await db.relAnnotationMappingCategory.bulkAdd(allNewRels);
          }
        }
      }
    );

    // 3. Single Redux dispatch
    dispatch(triggerAnnotationsUpdate());
  };
}
