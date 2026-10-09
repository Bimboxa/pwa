import DRAWING_SHAPES from "./drawingShapes.jsx";

// Annotation types offered by the "Dessin" tool (templateless annotations),
// in menu order. Technical shapes (revolution axis, base map link, opening,
// linear layout, circulation, 3D object) stay template-driven.
const TEMPLATELESS_DRAWING_SHAPE_KEYS = [
  "POLYLINE",
  "POLYGON",
  "MARKER",
  "POINT",
  "LABEL",
  "FREE_TEXT",
  "DETAIL",
  "IMAGE",
  "COTE",
  "RULER",
];

const TEMPLATELESS_DRAWING_SHAPES = TEMPLATELESS_DRAWING_SHAPE_KEYS.map((key) =>
  DRAWING_SHAPES.find((shape) => shape.key === key)
).filter(Boolean);

export default TEMPLATELESS_DRAWING_SHAPES;
