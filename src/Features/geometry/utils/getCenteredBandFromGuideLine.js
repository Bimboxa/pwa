// Build a closed band ring CENTERED on a guideLine, by projecting each guideLine
// CONTROL point perpendicular to the line by ±width/2 — WITHOUT discretizing arcs.
//
// Each control point's `type` (square / circle) is carried onto both band edges,
// so a square→circle→square arc on the guideLine is reproduced as a square→circle
// →square arc on each edge of the band (the renderer / 3D builder reconstruct the
// arc from those 3 control points). This keeps the polygon at 2·N points instead
// of densely sampling every arc.
//
// The arc-aware per-vertex normal that makes the cross-section orthogonal to the
// line lives in offsetControlPolyline — the band is just its +half / -half edges.
//
// Input  : controlPts = [{x, y, type?}, ...] (open polyline, pixel space)
//          widthPx     = band width in pixels
// Output : closed ring [{x, y, type}, ...] = leftEdge + reversed rightEdge
//          (no closing duplicate). Empty array when degenerate.

import offsetControlPolyline from "./offsetControlPolyline";

export default function getCenteredBandFromGuideLine(controlPts, widthPx) {
  const n = Array.isArray(controlPts) ? controlPts.length : 0;
  if (n < 2 || !(widthPx > 0)) return [];

  const half = widthPx / 2;
  const left = offsetControlPolyline(controlPts, half);
  const right = offsetControlPolyline(controlPts, -half);

  return [...left, ...right.reverse()];
}
