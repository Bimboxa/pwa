import { useDispatch } from "react-redux";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import linkAnnotationsToBusinessObjectService from "../services/linkAnnotationsToBusinessObjectService";

export default function useLinkAnnotationsToBusinessObject() {
  const dispatch = useDispatch();

  const link = async ({ businessObject, annotationIds }) => {
    const newRels = await linkAnnotationsToBusinessObjectService({
      businessObject,
      annotationIds,
    });

    dispatch(triggerRelsBusinessObjectAnnotationUpdate());

    const total = annotationIds?.length ?? 0;
    const skipped = total - newRels.length;
    const message =
      newRels.length === 0
        ? `Déjà lié à "${businessObject.label}"`
        : `${newRels.length} annotation${newRels.length > 1 ? "s" : ""} liée${
            newRels.length > 1 ? "s" : ""
          } à "${businessObject.label}"` +
          (skipped > 0 ? ` (${skipped} déjà liée${skipped > 1 ? "s" : ""})` : "");
    dispatch(setToaster({ message }));

    return newRels;
  };

  return link;
}
