// Whether « Découpe horizontale / verticale » (Coupe face, 3D) cuts the
// annotation as a SURFACE: its displayed solid is split into pieces by
// stored cut planes (annotation.surfaceCuts, see applySurfaceCuts) instead
// of being converted into a planar-face mesh (isMesh3d).
//
// These are exactly the hosts isAnnotationConvertibleToMesh3d refuses for
// their generated geometry: lathe revolutions, swept profiles, shells
// (dome / tent), inline extrusions and ramps — curved or faceted surfaces
// that would turn into thousands of planar faces. They keep their
// parametric 2D definition; the cuts only partition the displayed surface.
//
// Pure (no three.js): node-testable.

const SURFACE_SHAPE_KEYS = new Set([
  "REVOLUTION",
  "EXTRUSION_PROFILE",
  "SHELL_DOME",
  "SHELL_TENT",
  // DISC « Coupole »: a lathe of the dome profile (buildDiscObject3D), its
  // mesh carries the revolutionAxis the V cut needs for the meridian plane.
  "DISC_DOME",
]);

const hasLines = (lines) => lines?.some((l) => l?.points?.length >= 2);

export default function isSurfaceCutHost(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  if (annotation.isOpening || annotation.isMeshCell) return false;
  const key = annotation.shape3D?.key;
  if (key) return SURFACE_SHAPE_KEYS.has(key);
  return Boolean(
    hasLines(annotation.profileLines) ||
    hasLines(annotation.isoHeightLines) ||
    hasLines(annotation.guideLines)
  );
}
