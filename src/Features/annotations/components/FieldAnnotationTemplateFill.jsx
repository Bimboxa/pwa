import FieldFillCompact from "Features/form/components/FieldFillCompact";

// Template-level fill editor. The UI now lives in the shared compact control
// (colour + type + opacity on a single line, popover for palette/opacity/locks);
// this thin wrapper keeps the existing import path and props contract, including
// the per-field template override locks.
export default function FieldAnnotationTemplateFill({
  value,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Remplissage",
}) {
  return (
    <FieldFillCompact
      value={value}
      onChange={onChange}
      overrideFields={overrideFields}
      onOverrideFieldsChange={onOverrideFieldsChange}
      label={label}
    />
  );
}
