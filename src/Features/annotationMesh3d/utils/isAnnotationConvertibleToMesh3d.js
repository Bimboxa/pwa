// Whether a regular annotation may be turned into an `isMesh3d` annotation
// (its 3D solid frozen into a face mesh) by a push/pull or a line drawn on
// one of its faces.
//
// Only the annotations whose solid is a plain extrusion qualify: generated
// shapes (revolutions, swept profiles, shells, ramps) would turn into
// thousands of facets, and openings are glued to their host wall.
const CONVERTIBLE_TYPES = ["POLYGON", "POLYLINE", "STRIP"];

export default function isAnnotationConvertibleToMesh3d(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  if (!CONVERTIBLE_TYPES.includes(annotation.type)) return false;
  if (annotation.isOpening || annotation.isMeshCell) return false;
  if (annotation.shape3D?.key) return false;
  const hasLines = (lines) => lines?.some((l) => l?.points?.length >= 2);
  if (
    hasLines(annotation.profileLines) ||
    hasLines(annotation.isoHeightLines) ||
    hasLines(annotation.guideLines)
  ) {
    return false;
  }
  return true;
}
