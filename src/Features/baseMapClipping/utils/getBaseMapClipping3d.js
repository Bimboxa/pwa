// Clipping slab of a base map used as a 3D clipping plane (« Plan de coupe »
// of the base map panel), stored on the record as `baseMap.clipping3d`:
//   - enabled:    the base map offers the clipping plane (panel switch): its
//                 row of the base maps list then shows the scissors button.
//                 The cut itself is that button's SESSION state
//                 (threedEditor.clippingBaseMapIdsIn3d): two distinct states;
//   - frontM:     depth kept IN FRONT of the base map (its +normal side, the
//                 side annotation heights extrude to), in metres;
//   - backM:      depth kept BEHIND it;
//   - toleranceM: half thickness of the slice vectorized by « Vectoriser la
//                 coupe » (the points within ± toleranceM of the plane).
// A depth explicitly stored as null means "no limit on that side"; a missing
// field falls back to the default.

export const DEFAULT_CLIPPING_FRONT_M = 0.1;
export const DEFAULT_CLIPPING_BACK_M = 0.1;
export const DEFAULT_CLIPPING_TOLERANCE_M = 0.01;

function resolveDepth(value, fallback) {
  if (value === null) return null;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export default function getBaseMapClipping3d(baseMap) {
  const stored = baseMap?.clipping3d ?? {};
  const tolerance = stored.toleranceM;
  return {
    enabled: Boolean(stored.enabled),
    frontM: resolveDepth(stored.frontM, DEFAULT_CLIPPING_FRONT_M),
    backM: resolveDepth(stored.backM, DEFAULT_CLIPPING_BACK_M),
    toleranceM:
      Number.isFinite(tolerance) && tolerance > 0
        ? tolerance
        : DEFAULT_CLIPPING_TOLERANCE_M,
  };
}
