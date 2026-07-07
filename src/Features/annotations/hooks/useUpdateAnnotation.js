import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

export default function useUpdateAnnotation() {
  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (updates, options) => {
    // Deferred writes from the drawing commit (see useHandleCommitDrawing):
    // point rows + snap updates land in the SAME Dexie transaction as the
    // annotation update, so the liveQueries re-run once per commit.
    const pointRowsToSave = options?.pointRowsToSave ?? [];
    const annotationUpdatesInTx = options?.annotationUpdatesInTx ?? [];

    if (pointRowsToSave.length > 0 || annotationUpdatesInTx.length > 0) {
      await db.transaction("rw", db.points, db.annotations, async () => {
        if (pointRowsToSave.length > 0) {
          await db.points.bulkAdd(pointRowsToSave);
        }
        for (const u of annotationUpdatesInTx) {
          await db.annotations.update(u.id, u.changes);
        }
        await db.annotations.update(updates.id, { ...updates });
      });
    } else {
      await db.annotations.update(updates.id, { ...updates });
    }

    // When annotationTemplateId changes, sync relAnnotationMappingCategory
    if (updates.annotationTemplateId !== undefined && updates.id && projectId) {
      try {
        // Delete old rels from annotationTemplate source
        const existingRels = await db.relAnnotationMappingCategory
          .where("annotationId")
          .equals(updates.id)
          .toArray();
        const templateRelIds = existingRels
          .filter((r) => r.source === "annotationTemplate")
          .map((r) => r.id);
        if (templateRelIds.length > 0) {
          await db.relAnnotationMappingCategory.bulkDelete(templateRelIds);
        }

        // Create new rels from the new template's mappingCategories
        if (updates.annotationTemplateId) {
          const template = await db.annotationTemplates.get(
            updates.annotationTemplateId
          );
          const rawCategories = template?.mappingCategories ?? [];
          const newRels = rawCategories
            .map((entry) => {
              if (typeof entry !== "string") return null;
              const parts = entry.split(":");
              if (parts.length !== 2) return null;
              return {
                id: nanoid(),
                annotationId: updates.id,
                projectId,
                nomenclatureKey: parts[0].trim(),
                categoryKey: parts[1].trim(),
                source: "annotationTemplate",
              };
            })
            .filter(Boolean);

          if (newRels.length > 0) {
            await db.relAnnotationMappingCategory.bulkAdd(newRels);
          }
        }
      } catch (err) {
        console.warn(
          "[useUpdateAnnotation] Could not sync relAnnotationMappingCategory:",
          err
        );
      }
    }

    dispatch(triggerAnnotationsUpdate());

    return updates;
  };
}
