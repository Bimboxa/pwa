import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import updateAnnotationService from "../services/updateAnnotationService";

import db from "App/db/db";

export default function useUpdateAnnotation() {
  const dispatch = useDispatch();

  return async (updates) => {
    //await updateAnnotationService(annotation, options);
    console.log("debug_0203_update_annotation", updates);
    await db.annotations.update(updates.id, { ...updates });
    dispatch(triggerAnnotationsUpdate());

    return updates;
  };
}
