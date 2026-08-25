import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import FieldAnnotationTemplateLinearLayout from "./FieldAnnotationTemplateLinearLayout";

const LINEAR_LAYOUT_FIELDS = [
  "densityMode",
  "densityValue",
  "densityUnitLabel",
  "layoutAlign",
  "axisPosition",
  "textAlign",
  "hideBandFill",
];

// Per-annotation calepinage editor (PanelProperties): same UI as the template
// field, but writes the density / alignment / axis-position props onto the
// annotation row itself. No padlock (onOverrideFieldsChange not provided —
// override locks are a template-level concern).
export default function FieldAnnotationLinearLayout({ annotation }) {
  const updateAnnotation = useUpdateAnnotation();

  async function handleChange(updated) {
    if (!annotation?.id) return;
    const patch = { id: annotation.id };
    for (const key of LINEAR_LAYOUT_FIELDS) {
      if (updated[key] !== annotation[key]) patch[key] = updated[key];
    }
    if (Object.keys(patch).length > 1) await updateAnnotation(patch);
  }

  return (
    <FieldAnnotationTemplateLinearLayout
      annotationTemplate={annotation}
      onChange={handleChange}
    />
  );
}
