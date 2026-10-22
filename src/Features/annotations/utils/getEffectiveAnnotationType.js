import {
  getAnnotationType,
  getGeometryKindFromType,
  resolveDrawingShape,
} from "../constants/drawingShapeConfig";
import isDegeneratePolygonRow from "./isDegeneratePolygonRow";

// The annotation `type` the resolver should actually dispatch on.
//
// A DB row can carry a `type` whose geometry family does not match the
// geometry it stores: a POLYGON re-templated with a LABEL template used to be
// written back as `type: "LABEL"` while keeping its `points` refs and no
// targetPoint / labelPoint (useChangeAnnotationTemplate before the geometry
// family guard). Reading such a row as a LABEL throws in useAnnotationsV2 and
// takes the whole map editor down. This helper heals it in memory: a
// LABEL / FREE_TEXT row without its 2-point geometry but with point refs is
// read as the type of its own drawingShape (POLYGON / POLYLINE fallback).
// Read-time only — the row is repaired on its next template change
// (getAnnotationTypeOnTemplateChange resolves from this effective type).
//
// Same heal for a POLYGON row with fewer than 3 point refs (a vertical band
// drawn in 3D that a template change typed POLYGON, see
// isDegeneratePolygonRow): read as the POLYLINE it is, so the 3D wall and the
// 2D line render again instead of nothing.
export default function getEffectiveAnnotationType(annotation) {
  const type = annotation?.type;
  if (type === "POLYGON" && isDegeneratePolygonRow(annotation)) {
    return "POLYLINE";
  }
  if (getGeometryKindFromType(type) !== "LABEL") return type;

  const hasLabelGeometry = Boolean(
    annotation?.targetPoint && annotation?.labelPoint
  );
  if (hasLabelGeometry) return type;

  const points = annotation?.points;
  if (!Array.isArray(points) || points.length === 0) return type;

  const shapeType = getAnnotationType(resolveDrawingShape(annotation));
  if (shapeType && getGeometryKindFromType(shapeType) === "POINTS") {
    return shapeType;
  }
  return points.length >= 3 ? "POLYGON" : "POLYLINE";
}
