import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import FieldAnnotationTemplateArrows from "./FieldAnnotationTemplateArrows";

const ARROW_FIELDS = ["arrowStep", "arrowRight", "arrowLeft"];

// Per-annotation "Flèches" editor (PanelProperties) for CIRCULATION rows:
// same UI as the template field, writes the arrow props onto the annotation
// itself. No padlock (override locks are a template-level concern).
export default function FieldAnnotationArrows({ annotation }) {
  const updateAnnotation = useUpdateAnnotation();

  async function handleChange(updated) {
    if (!annotation?.id) return;
    const patch = { id: annotation.id };
    for (const key of ARROW_FIELDS) {
      if (updated[key] !== annotation[key]) patch[key] = updated[key];
    }
    if (Object.keys(patch).length > 1) await updateAnnotation(patch);
  }

  return (
    <FieldAnnotationTemplateArrows
      annotationTemplate={annotation}
      onChange={handleChange}
    />
  );
}
