import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// Resolves the data the elevation tool needs from the currently selected
// annotation. The tool supports POLYLINE walls and POLYGON surfaces (closed
// ring; isoHeightLines editable); for anything else `isProfileTarget` is false
// and the panel shows the baseMap viewer sub-panel.
//
// `points` are already resolved to pixel space (x/y) and carry per-vertex
// `offsetBottom` / `offsetTop` (meters) — see resolvePoints / useAnnotationsV2.
// `isoHeightLines` are resolved too ({points: [{x,y}...], height}).
export default function useElevationAnnotation() {
  const annotation = useSelectedAnnotation();
  const baseMap = useMainBaseMap();

  const isPolyline = annotation?.type === "POLYLINE";
  const isPolygon = annotation?.type === "POLYGON";
  const isProfileTarget = isPolyline || isPolygon;

  const points = isProfileTarget ? (annotation?.points ?? []) : [];
  // A POLYGON ring is closed by definition.
  const closeLine = isPolygon
    ? true
    : isPolyline
      ? Boolean(annotation?.closeLine)
      : false;
  const meterByPx = baseMap?.getMeterByPx?.() ?? null;
  const height = parseFloat(annotation?.height) || 0;
  const offsetZ = Number(annotation?.offsetZ) || 0;
  // primary color = the annotation's own color
  const color = annotation?.strokeColor || annotation?.fillColor || "#c0392b";

  const isoHeightLines = isPolygon ? (annotation?.isoHeightLines ?? []) : [];
  // Resolved profileLines ({points: [{x, y, height, locked?}...]}). POLYGON:
  // heights baked with endpoint continuity by useAnnotationsV2. POLYLINE
  // (extrusion cross-section): free endpoints, all heights inline.
  const profileLines = isProfileTarget ? (annotation?.profileLines ?? []) : [];

  return {
    annotation: isProfileTarget ? annotation : null,
    annotationId: isProfileTarget ? annotation?.id : null,
    isPolyline,
    isPolygon,
    isProfileTarget,
    points,
    closeLine,
    baseMap,
    meterByPx,
    height,
    offsetZ,
    color,
    isoHeightLines,
    profileLines,
  };
}
