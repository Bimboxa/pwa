import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

// Resolves the data the mesh tool needs from the currently selected annotation.
// Supports two modes:
//   - POLYGON  → the polygon is meshed directly in map pixel space.
//   - POLYLINE → its developed elevation is meshed (see MeshEditor), and cells
//     convert back to POLYLINE annotations with offsetBottom / offsetTop.
//
// `points` are already resolved to pixel space (x/y) by useAnnotationsV2.
export default function useMeshAnnotation() {
  const selected = useSelectedAnnotation();
  const baseMap = useMainBaseMap();

  // When a maille (mesh cell) is selected, mesh its PARENT annotation (the
  // whole meshed surface) and remember which maille is selected so the mesh
  // view can highlight it. Otherwise mesh the selected annotation directly.
  const annotations = useAnnotationsV2({ caller: "useMeshAnnotation" });
  const isMaille = Boolean(selected?.isMeshCell && selected?.parentAnnotationId);
  const parent = isMaille
    ? annotations?.find((a) => a.id === selected.parentAnnotationId)
    : null;
  const annotation = parent ?? selected;
  const selectedMailleLabel = isMaille ? (selected?.label ?? null) : null;
  const selectedMailleId = isMaille ? (selected?.id ?? null) : null;

  const type = annotation?.type;
  const mode =
    type === "POLYGON" ? "POLYGON" : type === "POLYLINE" ? "POLYLINE" : null;

  const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  const meterByPx = baseMap?.getMeterByPx?.() ?? null;

  const points = mode ? (annotation?.points ?? []) : [];
  const closeLine = Boolean(annotation?.closeLine);
  const height = parseFloat(annotation?.height) || 0;
  const offsetZ = Number(annotation?.offsetZ) || 0;
  const color =
    annotation?.fillColor || annotation?.strokeColor || "#1976d2";

  return {
    annotation: mode ? annotation : null,
    annotationId: mode ? annotation?.id : null,
    mode,
    baseMap,
    imageSize,
    meterByPx,
    points,
    closeLine,
    height,
    offsetZ,
    color,
    meshLines: annotation?.meshLines ?? [],
    selectedMailleLabel,
    selectedMailleId,
  };
}
