import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import updateAnnotationService from "../services/updateAnnotationService";

export default function useUpdateAnnotation() {
  const dispatch = useDispatch();

  return async (annotation) => {
    await updateAnnotationService(annotation);
    dispatch(triggerAnnotationsUpdate());

    return annotation;
  };
}
