// drawingShape → annotation `type`, as a PURE module (no theme / MUI import)
// so it runs under `node --test` (Prompt IA payload normalization).
//
// Mirrors DRAWING_SHAPE_CONFIG[shape].annotationType and the legacy shapes
// of resolveDrawingShape (drawingShapeConfig.js): keep the two in sync.

const TYPE_BY_SHAPE = {
  MARKER: "MARKER",
  POINT: "POINT",
  TEXT: "TEXT",
  LABEL: "LABEL",
  FREE_TEXT: "FREE_TEXT",
  DETAIL: "DETAIL",
  IMAGE: "IMAGE",
  POLYLINE: "POLYLINE",
  POLYGON: "POLYGON",
  DISC: "DISC",
  OPENING: "POLYLINE",
  CIRCULATION: "POLYLINE",
  OBJECT_3D: "OBJECT_3D",
  LINEAR_LAYOUT: "LINEAR_LAYOUT",
  BASE_MAP_LINK: "BASE_MAP_LINK",
  REVOLUTION_AXIS: "REVOLUTION_AXIS",
  REVOLUTION_AXIS_PLACEMENT: "REVOLUTION_AXIS_PLACEMENT",
  RULER: "RULER",
  COTE: "COTE",
  // legacy shapes of old templates
  POLYLINE_2D: "POLYLINE",
  SURFACE_2D: "POLYGON",
};

/**
 * Annotation `type` of a template: its own `type` when set, else the type
 * its `drawingShape` writes. Null when neither resolves.
 */
export default function resolveAnnotationTypeFromDrawingShape(template) {
  if (!template) return null;
  if (typeof template.type === "string" && template.type) return template.type;
  return TYPE_BY_SHAPE[template.drawingShape] ?? null;
}
