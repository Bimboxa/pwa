import { useDispatch } from "react-redux";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";

import toggleAnnotationBusinessObjectLinkService from "../services/toggleAnnotationBusinessObjectLinkService";

export default function useToggleAnnotationBusinessObjectLink() {
  const dispatch = useDispatch();

  const toggle = async ({ businessObject, annotationId }) => {
    const result = await toggleAnnotationBusinessObjectLinkService({
      businessObject,
      annotationId,
    });
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
    return result;
  };

  return toggle;
}
