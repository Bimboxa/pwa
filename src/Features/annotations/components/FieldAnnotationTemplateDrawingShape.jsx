import FieldOptionKeyFromIconsVariantToolbar from "Features/form/components/FieldOptionKeyFromIconsVariantToolbar";

import DRAWING_SHAPES from "Features/annotations/constants/drawingShapes.jsx";

export default function FieldAnnotationTemplateDrawingShape({
  value,
  onChange,
}) {
  return (
    <FieldOptionKeyFromIconsVariantToolbar
      value={value}
      label="Forme 2D"
      onChange={onChange}
      valueOptions={DRAWING_SHAPES}
      options={{ showAsSection: true }}
    />
  );
}
