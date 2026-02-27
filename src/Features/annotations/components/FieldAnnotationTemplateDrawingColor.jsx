import FieldColorV2 from "Features/form/components/FieldColorV2";

export default function FieldAnnotationTemplateDrawingColor({
  value,
  onChange,
}) {
  return (
    <FieldColorV2
      value={value}
      label="Couleur"
      onChange={onChange}
      options={{ showAsSection: true }}
    />
  );
}
