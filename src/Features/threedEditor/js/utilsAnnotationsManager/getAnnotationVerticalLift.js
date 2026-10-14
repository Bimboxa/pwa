// Render-only vertical lift of an annotation in basemap-local Z: the stored
// offsetZ plus the template "Delta offset 3D" (deltaOffsetZ3d, POLYGON only),
// which keeps two superposed floors from z-fighting. Never used by the auto
// procedures and the 2D editor, which read annotation.offsetZ directly.
export default function getAnnotationVerticalLift(annotation) {
  const offsetZ = Number(annotation?.offsetZ) || 0;
  if (annotation?.type !== "POLYGON") return offsetZ;
  return offsetZ + (Number(annotation.deltaOffsetZ3d) || 0);
}
