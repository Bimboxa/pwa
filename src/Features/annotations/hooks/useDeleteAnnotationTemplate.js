import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import {
  getLiveMeshPaintIdsByHostIds,
  getLiveMeshPaintIdsByTemplateIds,
} from "Features/meshPaint/services/deleteMeshPaintsService";

export default function useDeleteAnnotationTemplate() {
  const dispatch = useDispatch();

  async function getAnnotationCount(annotationTemplateId) {
    return db.annotations
      .where("annotationTemplateId")
      .equals(annotationTemplateId)
      .filter((a) => !a.deletedAt)
      .count();
  }

  // Live painted mesh parts made with the template (« Pinceau » 3D), deleted
  // with it.
  async function getMeshPaintCount(annotationTemplateId) {
    return db.meshPaints
      .where("annotationTemplateId")
      .equals(annotationTemplateId)
      .filter((r) => !r.deletedAt)
      .count();
  }

  async function deleteAnnotationTemplate(annotationTemplateId) {
    const annotationIds = await db.annotations
      .where("annotationTemplateId")
      .equals(annotationTemplateId)
      .primaryKeys();
    // Painted parts made WITH the template, and painted parts hosted BY its
    // annotations (any template).
    const [paintIdsByTemplate, paintIdsByHost] = await Promise.all([
      getLiveMeshPaintIdsByTemplateIds([annotationTemplateId]),
      getLiveMeshPaintIdsByHostIds(annotationIds, { writableOnly: true }),
    ]);
    const meshPaintIds = [
      ...new Set([...paintIdsByTemplate, ...paintIdsByHost]),
    ];

    await withUndoGroup(async () => {
      if (meshPaintIds.length > 0) await db.meshPaints.bulkDelete(meshPaintIds);
      await db.annotations.bulkDelete(annotationIds);
      await db.annotationTemplates.delete(annotationTemplateId);
    });
    dispatch(triggerAnnotationTemplatesUpdate());
  }

  return { deleteAnnotationTemplate, getAnnotationCount, getMeshPaintCount };
}
