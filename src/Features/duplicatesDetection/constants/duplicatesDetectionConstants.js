// « Détection des doublons »: annotations of the same template whose line
// geometry overlaps (totally or partially). Every tunable of the matcher
// lives here; the tolerance itself is user-adjustable in the helper
// (duplicatesDetectionSlice.toleranceCm) and defaults to DEFAULT_TOLERANCE_CM.

// Annotation types compared: lines and strips (a STRIP is compared on its
// stored path, like « Aligner »). Surfaces are left out on purpose: two
// polygons sharing a side are neighbours, not duplicates.
export const DUPLICATE_TYPES = ["POLYLINE", "STRIP"];

// Max distance between the two paths for them to count as superposed.
export const DEFAULT_TOLERANCE_CM = 2;
// Without a calibrated base map the tolerance is expressed in pixels.
export const TOLERANCE_PX_FALLBACK = 2;
// Floor of the pixel threshold (a very fine scale must not reach 0).
export const MIN_THRESHOLD_PX = 0.5;

// Shared portions shorter than this are ignored (corner slivers, crossings).
export const MIN_OVERLAP_M = 0.1;
export const MIN_OVERLAP_PX = 10;

// overlap / own length above this ratio ⇒ the annotation is a "total"
// duplicate (fully covered by its partners), otherwise "partial".
export const TOTAL_COVERAGE = 0.98;

// The matcher runs in a Web Worker (true async, the toolbar spinner paints);
// false forces the main-thread fallback of duplicatesDetectionService.
export const USE_WORKER = true;
