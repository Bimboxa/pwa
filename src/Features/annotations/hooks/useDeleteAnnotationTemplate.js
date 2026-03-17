import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useDeleteAnnotationTemplate() {
  const dispatch = useDispatch();

  async function getAnnotationCount(annotationTemplateId) {
    return db.annotations
      .where("annotationTemplateId")
      .equals(annotationTemplateId)
      .filter((a) => !a.deletedAt)
      .count();
  }

  async function deleteAnnotationTemplate(annotationTemplateId) {
    const annotationIds = await db.annotations
      .where("annotationTemplateId")
      .equals(annotationTemplateId)
      .primaryKeys();
    await db.annotations.bulkDelete(annotationIds);
    await db.annotationTemplates.delete(annotationTemplateId);
    dispatch(triggerAnnotationTemplatesUpdate());
  }

  return { deleteAnnotationTemplate, getAnnotationCount };
}
