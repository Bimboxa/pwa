import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateAnnotation from "./useUpdateAnnotation";

import getAnnotationTemplateChangeUpdates from "../utils/getAnnotationTemplateChangeUpdates";

export default function useChangeAnnotationTemplate() {
  const baseMap = useMainBaseMap();
  const updateAnnotation = useUpdateAnnotation();

  return async function changeAnnotationTemplate(annotation, template) {
    // Diff-only patch: the annotation may be the resolved row (toolbar), so
    // its pixel geometry / derived fields must never be written back.
    const updates = getAnnotationTemplateChangeUpdates({
      annotation,
      template,
      baseMap,
    });
    if (!updates) return;

    await updateAnnotation(updates);
  };
}
