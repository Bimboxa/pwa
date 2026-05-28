import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";

// STRIP <-> POLYLINE conversion geometry (pixel space).
//
// A STRIP stores ONE EDGE of the band in `points`; the visible band is the edge
// offset by the full strokeWidth toward `stripOrientation`. The band centerline
// therefore sits half the width away from the edge:
//   centerline = offsetPolyline(edge, orientation * Wpx / 2)
//   edge       = offsetPolyline(centerline, -orientation * Wpx / 2)
// This mirrors the offsets in useToggleAnnotationStripType.

// Band width in pixels (matches getStripePolygons / useToggleAnnotationStripType).
export function getStripWidthPx(
  { strokeWidth = 2, strokeWidthUnit = "PX" } = {},
  meterByPx
) {
  return strokeWidthUnit === "CM" && meterByPx > 0
    ? (strokeWidth * 0.01) / meterByPx
    : strokeWidth;
}

// edge pixel points -> centerline pixel points (fresh ids).
export function stripEdgeToCenterline(pixelPoints, Wpx, orientation = 1) {
  return offsetPolyline(pixelPoints, (orientation * Wpx) / 2);
}

// centerline pixel points -> single-edge pixel points (fresh ids).
export function centerlineToStripEdge(pixelPoints, Wpx, orientation = 1) {
  return offsetPolyline(pixelPoints, (-orientation * Wpx) / 2);
}

// The fields that define a STRIP's appearance, carried over when an operation
// recreates strip geometry from a polyline result.
export function getStripProps(annotation = {}) {
  return {
    strokeWidth: annotation.strokeWidth,
    strokeWidthUnit: annotation.strokeWidthUnit,
    stripOrientation: annotation.stripOrientation ?? 1,
    fillColor: annotation.fillColor,
    fillOpacity: annotation.fillOpacity,
    strokeType: annotation.strokeType,
  };
}
