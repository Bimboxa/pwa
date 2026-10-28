import { useDispatch } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";

import toggleAnnotationBusinessObjectLinkService from "../services/toggleAnnotationBusinessObjectLinkService";

export default function useToggleAnnotationBusinessObjectLink() {
  const dispatch = useDispatch();

  const toggle = async ({ businessObject, annotationId }) => {
    const result = await toggleAnnotationBusinessObjectLinkService({
      businessObject,
      annotationId,
    });
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
    // linking may have lifted an exclusion on the object row
    if (result === "linked") dispatch(triggerBusinessObjectsUpdate());
    return result;
  };

  return toggle;
}
