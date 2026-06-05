import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// Resolves the data the elevation tool needs from the currently selected
// annotation. The tool only supports POLYLINE walls; for anything else
// `isPolyline` is false and the panel shows an empty state.
//
// `points` are already resolved to pixel space (x/y) and carry per-vertex
// `offsetBottom` / `offsetTop` (meters) — see resolvePoints / useAnnotationsV2.
export default function useElevationAnnotation() {
  const annotation = useSelectedAnnotation();
  const baseMap = useMainBaseMap();

  const isPolyline = annotation?.type === "POLYLINE";

  const points = isPolyline ? annotation?.points ?? [] : [];
  const meterByPx = baseMap?.getMeterByPx?.() ?? null;
  const height = parseFloat(annotation?.height) || 0;
  const offsetZ = Number(annotation?.offsetZ) || 0;
  // primary color = the polyline's own color
  const color =
    annotation?.strokeColor || annotation?.fillColor || "#c0392b";

  return {
    annotation: isPolyline ? annotation : null,
    annotationId: isPolyline ? annotation?.id : null,
    isPolyline,
    points,
    baseMap,
    meterByPx,
    height,
    offsetZ,
    color,
  };
}
