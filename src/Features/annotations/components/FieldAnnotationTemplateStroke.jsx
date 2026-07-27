import FieldStrokeCompact from "Features/form/components/FieldStrokeCompact";

// Template-level stroke editor. The UI now lives in the shared compact control
// (colour + style + opacity on one line, popover for palette/opacity/width);
// this thin wrapper keeps the existing import path and props contract, including
// the template override lock.
export default function FieldAnnotationTemplateStroke({
  value,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Contour",
}) {
  return (
    <FieldStrokeCompact
      value={value}
      onChange={onChange}
      overrideFields={overrideFields}
      onOverrideFieldsChange={onOverrideFieldsChange}
      label={label}
    />
  );
}
