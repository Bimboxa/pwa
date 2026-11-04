// "Extrusion" (inline profile): a POLYLINE carrying its own cross-section in
// `profileLines`, swept along the guide chain by createAnnotationObject3D
// (buildInlineExtrusionMesh / buildInlineExtrusion3dMesh) — an OPEN
// double-sided surface (a sheet), not a closed volume. No `shape3D`: the
// parametric EXTRUSION_PROFILE (profile template on another base map) is a
// different mechanism, as is the shell of a POLYGON carrying profileLines.
//
// Shared by the subtraction pipeline (live carve + « Soustraire
// définitivement »), which must clip such a host as a surface (hollow
// boolean) rather than carve it as a solid.
export default function isInlineExtrusionPolyline(annotation) {
  if (!annotation || annotation.type !== "POLYLINE") return false;
  if (annotation.isMesh3d || annotation.isOpening || annotation.isMeshCell) {
    return false;
  }
  if (annotation.shape3D?.key) return false;
  return Boolean(annotation.profileLines?.some((l) => l?.points?.length >= 2));
}
