import FieldFillCompact from "./FieldFillCompact";

// Live-annotation fill editor. The UI now lives in the shared compact control;
// this thin wrapper keeps the existing import path and props contract
// (disabledFields greys out fields the annotation's template has locked).
export default function FieldFill({
  value,
  onChange,
  label = "Remplissage",
  disabledFields,
}) {
  return (
    <FieldFillCompact
      value={value}
      onChange={onChange}
      label={label}
      disabledFields={disabledFields}
    />
  );
}
