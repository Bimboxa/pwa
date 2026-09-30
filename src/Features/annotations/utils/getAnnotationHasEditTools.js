// True when EditAnnotationTools renders at least one tool for this annotation
// (mirrors its per-type conditions). Gates the "Plus d'outils" menu so it is
// never empty (POINT, FREE_TEXT, IMAGE...).
export default function getAnnotationHasEditTools(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  return (
    ["POLYLINE", "STRIP", "POLYGON", "RECTANGLE", "LINEAR_LAYOUT"].includes(
      annotation.type
    ) || annotation.shape3D?.key === "EXTRUSION_PROFILE"
  );
}
