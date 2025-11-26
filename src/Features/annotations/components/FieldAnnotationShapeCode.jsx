import FieldOptionKey from "Features/form/components/FieldOptionKey";

export default function FieldAnnotationShapeCode({ annotation, onChange }) {
  const valueOptions = [
    { key: "FLOOR_AND_WALLS", label: "Sol et murs" },
    { key: "VOLUME", label: "Volume" },
    { key: "CONE", label: "Cône" },
  ];

  //console.log("debug_2611_annotation", annotation);

  function handleChange(shapeCode) {
    console.log("debug_2611_changeShapeCode", shapeCode);
    onChange({ ...annotation, shapeCode });
  }
  return (
    <FieldOptionKey
      value={annotation?.shapeCode ?? "VOLUME"}
      onChange={handleChange}
      valueOptions={valueOptions}
    />
  );
}
