import isInlineExtrusionPolyline from "./isInlineExtrusionPolyline";

// A plain POLYLINE with a screen-space stroke (PX): createAnnotationObject3D
// extrudes it with extrudePolylineWall — one ZERO-THICKNESS quad per segment,
// an OPEN double-sided surface (a sheet), not a closed volume. Keep in sync
// with the POLYLINE branch of createAnnotationObject3D:
//   - a CM stroke is a real wall thickness (extrudeWallPolygon, closed solid);
//   - a `shape3D` (REVOLUTION) or an inline profile
//     (`profileLines`, see isInlineExtrusionPolyline) is another builder.
//
// Shared by the subtraction pipeline (live carve + « Soustraire
// définitivement »), which must clip such a host as a surface (hollow
// boolean) rather than carve it as a solid: a regular subtraction would add
// the cutter's cap faces and never yield a closed mesh.
export default function isPolylineSheetWall(annotation) {
  if (!annotation || annotation.type !== "POLYLINE") return false;
  if (annotation.isMesh3d || annotation.isOpening || annotation.isMeshCell) {
    return false;
  }
  if (annotation.shape3D?.key) return false;
  if (annotation.strokeWidthUnit === "CM") return false;
  return !isInlineExtrusionPolyline(annotation);
}
