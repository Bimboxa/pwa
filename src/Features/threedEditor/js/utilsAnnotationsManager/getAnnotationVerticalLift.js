import isAntiAliasingShrinkEnabled from "./isAntiAliasingShrinkEnabled";

// Render-only vertical lift of an annotation in basemap-local Z: the stored
// offsetZ plus the template "Delta offset 3D" (deltaOffsetZ3d, POLYGON only),
// which keeps two superposed floors from z-fighting. The delta follows the
// « Séparer les surfaces en contact » toggle like the footprint shrink
// (`options` = the 3D build options, see isAntiAliasingShrinkEnabled): off
// (the default), or for a shrink-exempt host, the lift is the bare offsetZ —
// so a mesh converted from the displayed object never bakes the delta in.
// Never used by the auto procedures and the 2D editor, which read
// annotation.offsetZ directly.
export default function getAnnotationVerticalLift(annotation, options) {
  const offsetZ = Number(annotation?.offsetZ) || 0;
  if (annotation?.type !== "POLYGON") return offsetZ;
  if (!isAntiAliasingShrinkEnabled(options, annotation)) return offsetZ;
  return offsetZ + (Number(annotation.deltaOffsetZ3d) || 0);
}
