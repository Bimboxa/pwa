import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useDeleteAnnotationTemplate() {
  const dispatch = useDispatch();

  return async (annotationTemplateId) => {
    await db.annotationTemplates.delete(annotationTemplateId);
    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
