import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateAnnotation from "./useUpdateAnnotation";

import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "../utils/getAnnotationPropsFromAnnotationTemplateProps";
import {
  resolveDrawingShape,
  getAnnotationType,
} from "../constants/drawingShapeConfig";

export default function useChangeAnnotationTemplate() {
  const baseMap = useMainBaseMap();
  const updateAnnotation = useUpdateAnnotation();

  return async function changeAnnotationTemplate(annotation, template) {
    if (!template || !annotation?.id) return;

    const templateProps = getAnnotationTemplateProps(template);
    const resolvedShape = resolveDrawingShape(template);
    const resolvedType = getAnnotationType(resolvedShape);

    // Only overwrite properties the template locks (overrideFields);
    // non-overridden fields keep the annotation's own value.
    const merged = getAnnotationPropsFromAnnotationTemplateProps(
      annotation,
      templateProps,
      baseMap
    );
    // annotationTemplateProps is a render-time snapshot (useAnnotationsV2
    // recomputes it); don't persist it to the DB record.
    delete merged.annotationTemplateProps;
    const updates = {
      ...merged,
      id: annotation.id,
      annotationTemplateId: template.id,
      templateLabel: template.label,
      listingId: template.listingId,
      // Persist the NEW template's lock set so the editor UI reflects it.
      overrideFields: templateProps.overrideFields,
    };
    if (resolvedType) updates.type = resolvedType;

    await updateAnnotation(updates);
  };
}
