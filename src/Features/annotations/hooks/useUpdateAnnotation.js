import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import updateAnnotationService from "../services/updateAnnotationService";

export default function useUpdateAnnotation() {
  const dispatch = useDispatch();

  return async (annotation, options) => {
    await updateAnnotationService(annotation, options);
    dispatch(triggerAnnotationsUpdate());

    return annotation;
  };
}
