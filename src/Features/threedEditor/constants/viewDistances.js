// "Distance de vue max" of the 3D editor: the regular zoom-out range (dolly
// limit; the camera far plane follows at twice the distance). Device
// preference edited in Configuration > Éditeur 3D.
//
// AUTO follows the loaded content: the default range, widened when a scan
// base map (hundreds of metres) would not fit in it.

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

// AUTO range for a set of base maps: 3x the diagonal of the largest scan
// zone (read from the base map descriptor — the mesh itself does not need
// to be loaded), never below the default.
export function getAutoViewDistance(baseMaps) {
  let maxDiagonal = 0;
  for (const baseMap of baseMaps ?? []) {
    const zone = baseMap?.scene3d?.zone;
    if (!zone) continue;
    const diagonal = Math.hypot(
      zone.width || 0,
      zone.height || 0,
      (zone.zMax ?? 0) - (zone.zMin ?? 0)
    );
    if (diagonal > maxDiagonal) maxDiagonal = diagonal;
  }
  return Math.max(DEFAULT_VIEW_DISTANCE_M, Math.ceil(3 * maxDiagonal));
}

export function resolveViewDistance(setting, baseMaps) {
  return setting === VIEW_DISTANCE_AUTO
    ? getAutoViewDistance(baseMaps)
    : setting;
}
