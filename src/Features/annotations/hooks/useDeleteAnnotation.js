import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useDeleteAnnotation() {
  const dispatch = useDispatch();

  return async (annotationId) => {
    await db.annotations.delete(annotationId);
    dispatch(triggerAnnotationsUpdate());
  };
}
