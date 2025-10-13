import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useUpdateAnnotationTemplate() {
  const dispatch = useDispatch();

  return async (updates) => {
    await db.annotationTemplates.update(updates.id, updates);
    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
