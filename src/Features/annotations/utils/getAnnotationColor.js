import {
  getShapeCategory,
  resolveDrawingShape,
} from "Features/annotations/constants/drawingShapeConfig";

export default function getAnnotationColor(annotation) {
  if (!annotation) return null;

  // A STRIP can be drawn from a POLYLINE template (whose configurable colour is
  // strokeColor — the contour) or from a POLYGON one (fillColor). NodeStripStatic
  // paints the band with strokeColor, so the resolved colour must follow the
  // origin drawingShape instead of always reading fillColor.
  if (annotation.type === "STRIP") {
    const isFromPolyline =
      getShapeCategory(resolveDrawingShape(annotation)) === "polyline";
    return isFromPolyline
      ? (annotation.strokeColor ?? annotation.fillColor)
      : (annotation.fillColor ?? annotation.strokeColor);
  }

  if (["MARKER", "POLYGON"].includes(annotation.type)) {
    return annotation.fillColor;
  } else if (
    ["POLYLINE", "REVOLUTION_AXIS", "REVOLUTION_AXIS_PLACEMENT"].includes(
      annotation.type
    )
  ) {
    return annotation.strokeColor;
  } else {
    return annotation.color;
  }
}
