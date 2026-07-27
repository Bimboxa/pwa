import FieldStrokeCompact from "./FieldStrokeCompact";

// Live-annotation stroke editor. The UI now lives in the shared compact control;
// this thin wrapper keeps the existing import path and props contract
// (disabledFields greys out fields the annotation's template has locked).
export default function FieldStroke({
  value,
  onChange,
  label = "Contour",
  disabledFields,
}) {
  return (
    <FieldStrokeCompact
      value={value}
      onChange={onChange}
      label={label}
      disabledFields={disabledFields}
    />
  );
}
