import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import FieldStrokeWidthCompact from "Features/form/components/FieldStrokeWidthCompact";

// Live-annotation stroke WIDTH editor ("Épaisseur"). Writes go through
// useUpdateAnnotation (not a raw db update): a width change on a STRIP host
// moves its median line, so the glued openings must be reflowed.
export default function FieldAnnotationStrokeWidth({
  annotation,
  overrideFields,
}) {
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const widthValue = {
    strokeWidth: annotation?.strokeWidth ?? 1,
    strokeWidthUnit: annotation?.strokeWidthUnit ?? "PX",
  };

  // handlers

  async function handleChange(newValue) {
    if (!annotation?.id) return;
    await updateAnnotation({
      id: annotation.id,
      strokeWidth: newValue.strokeWidth,
      strokeWidthUnit: newValue.strokeWidthUnit,
    });
  }

  // render

  return (
    <FieldStrokeWidthCompact
      value={widthValue}
      onChange={handleChange}
      disabledFields={overrideFields}
    />
  );
}
