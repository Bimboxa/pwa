// « Détection des doublons »: annotations of the same template whose line
// geometry overlaps (totally or partially). Every tunable of the matcher
// lives here; the tolerance itself is user-adjustable in the helper
// (duplicatesDetectionSlice.toleranceCm) and defaults to DEFAULT_TOLERANCE_CM.

// Annotation types compared: lines and strips (a STRIP is compared on its
// stored path, like « Aligner ») on their shared length, polygons on their
// intersection area (two polygons sharing a side are neighbours, not
// duplicates).
export const DUPLICATE_TYPES = ["POLYLINE", "STRIP", "POLYGON"];

// Max distance between the two paths for them to count as superposed.
export const DEFAULT_TOLERANCE_CM = 2;
// Without a calibrated base map the tolerance is expressed in pixels.
export const TOLERANCE_PX_FALLBACK = 2;
// Floor of the pixel threshold (a very fine scale must not reach 0).
export const MIN_THRESHOLD_PX = 0.5;

// Shared portions shorter than this are ignored (corner slivers, crossings).
export const MIN_OVERLAP_M = 0.1;
export const MIN_OVERLAP_PX = 10;

// overlap / own measure (length, or area for a polygon) above this ratio ⇒
// the annotation is a "total" duplicate (fully covered by its partners),
// otherwise "partial".
export const TOTAL_COVERAGE = 0.98;

// Polygons: the intersection must cover at least this share of the smaller
// polygon (and at least MIN_OVERLAP² in area) — adjacent surfaces whose
// common edge was drawn twice overlap by a sliver only.
export const MIN_POLYGON_COVERAGE = 0.05;

// The matcher runs in a Web Worker (true async, the toolbar spinner paints);
// false forces the main-thread fallback of duplicatesDetectionService.
export const USE_WORKER = true;
