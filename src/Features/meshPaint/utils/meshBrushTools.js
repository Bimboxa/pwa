// Pure helpers of the « Pinceau » (MESH_BRUSH) — node-testable, relative
// imports only (drawingShapeConfig pulls the MUI theme, so the shape
// resolution below is a minimal local copy of resolveDrawingShape).
import {
  MESH_BRUSH_TOOL_KEY,
  MESH_PAINT_PART_TYPES,
} from "../constants/meshPaintConstants.js";

export function isMeshBrushDrawingMode(mode) {
  return mode === MESH_BRUSH_TOOL_KEY;
}

// drawingShape → painted part type: a Surface template paints facets (m²), a
// Ligne template paints edges (ml). Any other shape cannot paint.
export function getMeshBrushPartType(drawingShape) {
  if (drawingShape === "POLYGON") return MESH_PAINT_PART_TYPES.FACE;
  if (drawingShape === "POLYLINE") return MESH_PAINT_PART_TYPES.EDGE;
  return null;
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

// Part type a template paints (null: the template cannot paint).
export function getMeshPaintPartTypeForTemplate(template) {
  return getMeshBrushPartType(resolveBrushDrawingShape(template));
}
