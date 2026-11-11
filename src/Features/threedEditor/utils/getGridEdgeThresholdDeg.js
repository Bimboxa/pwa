// EdgesGeometry dihedral threshold (degrees) of the black grid-edge lines,
// from the "Wireframe" 3D view settings (threedEditorSlice):
// - « Afficher le maillage 3D » (showTessellation) draws every facet seam of
//   the curved surfaces (revolutions, domes, sampled arcs): 1°, three's
//   default, below the ~5.6° between two slices of a 64-segment lathe.
// - Otherwise the user's crease tolerance (wireframeAngleDeg, 15 by default)
//   keeps only silhouettes, free borders and real folds.
// Shared by MainThreedEditor (annotation objects) and ThreedMeshPaints (the
// grid drawn over « Pinceau » paints) so both sides apply the same rule.
export const TESSELLATION_THRESHOLD_DEG = 1;

export const DEFAULT_CREASE_THRESHOLD_DEG = 15;

// Added to a crease threshold before comparing dihedral angles: a facet seam
// folding EXACTLY the threshold counts as below it. Without it the tie is
// decided by float noise, seam by seam — a circle of 24 chords folds 15° at
// every seam, the default threshold, and came out with a random subset of
// its seams drawn.
export const CREASE_TIE_EPS_DEG = 0.01;

export default function getGridEdgeThresholdDeg({
  showTessellation,
  wireframeAngleDeg,
}) {
  if (showTessellation) return TESSELLATION_THRESHOLD_DEG;
  const deg = Number(wireframeAngleDeg);
  return Number.isFinite(deg) ? deg : DEFAULT_CREASE_THRESHOLD_DEG;
}
