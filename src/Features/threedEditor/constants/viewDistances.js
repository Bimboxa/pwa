// "Distance de vue max" of the 3D editor: the regular zoom-out range (dolly
// limit; the camera far plane follows at twice the distance). Device
// preference edited in Configuration > Éditeur 3D.
//
// AUTO follows the loaded content: the default range, widened when a
// SCENE_3D scan (hundreds of metres) would not fit in it.

export const VIEW_DISTANCE_AUTO = "AUTO";
export const DEFAULT_VIEW_DISTANCE_M = 500;

const FIXED_VIEW_DISTANCES_M = [500, 1000, 2000, 5000];

const formatDistance = (meters) =>
  meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;

// Ordered options consumed by the Configuration page (SectionViewDistance).
export const VIEW_DISTANCE_OPTIONS = [
  {
    key: VIEW_DISTANCE_AUTO,
    label: "Automatique",
    description: `${formatDistance(DEFAULT_VIEW_DISTANCE_M)}, étendue automatiquement aux scènes 3D chargées`,
  },
  ...FIXED_VIEW_DISTANCES_M.map((meters) => ({
    key: meters,
    label: formatDistance(meters),
  })),
];

export function isViewDistance(value) {
  return value === VIEW_DISTANCE_AUTO || FIXED_VIEW_DISTANCES_M.includes(value);
}

// AUTO range for a set of resolved annotations: 3x the diagonal of the
// largest scan (read from the annotation descriptor — the mesh itself does
// not need to be loaded), never below the default.
export function getAutoViewDistance(annotations) {
  let maxDiagonal = 0;
  for (const annotation of annotations ?? []) {
    const bbox =
      annotation?.type === "SCENE_3D" ? annotation.scene3d?.bbox : null;
    if (!bbox?.min || !bbox?.max) continue;
    const diagonal = Math.hypot(
      bbox.max[0] - bbox.min[0],
      bbox.max[1] - bbox.min[1],
      bbox.max[2] - bbox.min[2]
    );
    if (diagonal > maxDiagonal) maxDiagonal = diagonal;
  }
  return Math.max(DEFAULT_VIEW_DISTANCE_M, Math.ceil(3 * maxDiagonal));
}

export function resolveViewDistance(setting, annotations) {
  return setting === VIEW_DISTANCE_AUTO
    ? getAutoViewDistance(annotations)
    : setting;
}
