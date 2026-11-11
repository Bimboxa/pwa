// Circle segmentation of the 3D meshes: how many chords stand for one full
// circle. Module-level settings (pure, node-testable — relative imports
// only) read at use by the arc sampling helpers and the lathe builders, so
// the rendered meshes AND the quantities computed on the same arc-expanded
// rings (getAnnotationQties) always share one discretization.
//
//   - arc: surfaces / lines drawn with arc points (S-C-S) — an extruded
//     circle, a curved wall. Default 24.
//   - revolution: discs and revolution solids (lathe). Default 64.
//
// Edited in the 3D view settings (SectionCircleSegmentation3d); the redux /
// localStorage side lives in Features/threedEditor
// (updateCircleSegmentation).

export const DEFAULT_ARC_SEGMENTS_PER_CIRCLE = 24;
export const DEFAULT_REVOLUTION_SEGMENTS_PER_CIRCLE = 64;
export const MIN_SEGMENTS_PER_CIRCLE = 8;
export const MAX_ARC_SEGMENTS_PER_CIRCLE = 128;
export const MAX_REVOLUTION_SEGMENTS_PER_CIRCLE = 256;

const clampCount = (value, fallback, max) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(MIN_SEGMENTS_PER_CIRCLE, n));
};

// { arc, revolution } with both counts as integers within their bounds
// (defaults for anything missing / invalid).
export function normalizeCircleSegmentation(value) {
  return {
    arc: clampCount(
      value?.arc,
      DEFAULT_ARC_SEGMENTS_PER_CIRCLE,
      MAX_ARC_SEGMENTS_PER_CIRCLE
    ),
    revolution: clampCount(
      value?.revolution,
      DEFAULT_REVOLUTION_SEGMENTS_PER_CIRCLE,
      MAX_REVOLUTION_SEGMENTS_PER_CIRCLE
    ),
  };
}

let current = normalizeCircleSegmentation(null);

export function getCircleSegmentation() {
  return current;
}

// Returns the normalized settings now in effect.
export function applyCircleSegmentation(value) {
  current = normalizeCircleSegmentation(value);
  return current;
}

export function getArcSegmentsPerCircle() {
  return current.arc;
}

export function getRevolutionSegmentsPerCircle() {
  return current.revolution;
}

// A fixed per-half-arc sample count written for the default arc
// segmentation (24 per circle), scaled to the current one: 6 stays 6 by
// default, becomes 12 at 48 segments per circle.
export function scaleArcSamples(baseSamples) {
  return Math.max(
    2,
    Math.round((baseSamples * current.arc) / DEFAULT_ARC_SEGMENTS_PER_CIRCLE)
  );
}
