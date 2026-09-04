import FieldStrokeWidthCompact from "Features/form/components/FieldStrokeWidthCompact";

// Template-level stroke WIDTH editor ("Épaisseur"), split out of the "Contour"
// row so the width lock (strokeWidth + strokeWidthUnit) is independent of the
// line style lock. Thin wrapper mirroring FieldAnnotationTemplateStroke.
export default function FieldAnnotationTemplateStrokeWidth({
  value,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Épaisseur",
}) {
  return (
    <FieldStrokeWidthCompact
      value={value}
      onChange={onChange}
      overrideFields={overrideFields}
      onOverrideFieldsChange={onOverrideFieldsChange}
      label={label}
    />
  );
}
