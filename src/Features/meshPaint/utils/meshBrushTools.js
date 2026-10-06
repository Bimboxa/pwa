// Pure helpers of the « Pinceau » (MESH_BRUSH) — node-testable, relative
// imports only (drawingShapeConfig pulls the MUI theme, so the shape
// resolution below is a minimal local copy of resolveDrawingShape).
import {
  MESH_BRUSH_PART_MODES,
  MESH_BRUSH_TOOL_KEY,
  MESH_PAINT_PART_TYPES,
} from "../constants/meshPaintConstants.js";

export function isMeshBrushDrawingMode(mode) {
  return mode === MESH_BRUSH_TOOL_KEY;
}

// drawingShape → DEFAULT painted part type (mode "AUTO"): a Surface template
// paints facets (m²), a Ligne template paints edges (ml). Any other shape
// cannot paint.
export function getMeshBrushPartType(drawingShape) {
  if (drawingShape === "POLYGON") return MESH_PAINT_PART_TYPES.FACE;
  if (drawingShape === "POLYLINE") return MESH_PAINT_PART_TYPES.EDGE;
  return null;
}

// Part type the brush paints for a drawing shape under a part mode
// (mapEditor.meshBrushPartMode): an explicit "FACE" / "EDGE" wins over the
// shape default — a Ligne template (« Surface verticale ») paints a wall
// face, a Surface template an edge. A shape that cannot paint stays null.
export function getEffectiveMeshBrushPartType(drawingShape, partMode) {
  const defaultType = getMeshBrushPartType(drawingShape);
  if (!defaultType) return null;
  if (
    partMode === MESH_BRUSH_PART_MODES.FACE ||
    partMode === MESH_BRUSH_PART_MODES.EDGE
  ) {
    return partMode;
  }
  return defaultType;
}

// Legacy drawingShape values + type fallback, mirroring resolveDrawingShape
// (Features/annotations/constants/drawingShapeConfig.js) for the two shapes
// the brush cares about.
const LEGACY_SHAPE = {
  SURFACE_2D: "POLYGON",
  POLYLINE_2D: "POLYLINE",
};
const TYPE_SHAPE = {
  POLYGON: "POLYGON",
  RECTANGLE: "POLYGON",
  POLYLINE: "POLYLINE",
  STRIP: "POLYLINE",
};

export function resolveBrushDrawingShape(templateOrDraft) {
  if (!templateOrDraft) return null;
  const shape = templateOrDraft.drawingShape;
  if (shape) return LEGACY_SHAPE[shape] ?? shape;
  return TYPE_SHAPE[templateOrDraft.type] ?? null;
}

// DEFAULT part type a template paints (null: the template cannot paint). A
// template may carry paints of BOTH part types (the brush part mode): never
// use this to filter stored paints.
export function getMeshPaintPartTypeForTemplate(template) {
  return getMeshBrushPartType(resolveBrushDrawingShape(template));
}

// True when the template can paint at all (Surface or Ligne shape).
export function canTemplatePaint(template) {
  return Boolean(getMeshPaintPartTypeForTemplate(template));
}
