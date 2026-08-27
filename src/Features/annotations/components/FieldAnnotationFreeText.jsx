import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import FieldAnnotationTemplateFreeText from "./FieldAnnotationTemplateFreeText";
import { FREE_TEXT_FIELDS } from "Features/annotations/constants/freeTextConstants";

// Per-annotation FREE_TEXT editor (PanelProperties): same UI as the template
// field, but writes the text-styling props onto the annotation row itself.
// No padlock (onOverrideFieldsChange not provided — override locks are a
// template-level concern).
export default function FieldAnnotationFreeText({ annotation }) {
  const updateAnnotation = useUpdateAnnotation();

  async function handleChange(updated) {
    if (!annotation?.id) return;
    const patch = { id: annotation.id };
    for (const key of FREE_TEXT_FIELDS) {
      if (updated[key] !== annotation[key]) patch[key] = updated[key];
    }
    if (Object.keys(patch).length > 1) await updateAnnotation(patch);
  }

  return (
    <FieldAnnotationTemplateFreeText
      annotationTemplate={annotation}
      onChange={handleChange}
    />
  );
}
