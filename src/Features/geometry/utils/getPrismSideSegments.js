import { adaptiveArcSamples, expandRingWithOffsets } from "./arcSampling.js";

// Side faces of the prism extruded from a closed ring (POLYGON with a height).
//
// The ring is expanded like the mesh builders do (expandRingWithOffsets, same
// arc sampling) and every EXPANDED segment (point k → point k + 1) gets:
//
// - hidden: its side face is not built. A straight source segment is hidden
//   when its index is in `hiddenSegmentsIdx`; an S-C-S arc is hidden as a
//   whole when either of its two source segments is (same rule as the
//   perimeter of getAnnotationQties).
// - label: face label telling apart the side faces that lie in the SAME
//   plane. Along a run of aligned straight segments (a vertex drawn in the
//   middle of a straight side, fold below COLLINEAR_JUNCTION_DEG) the j-th
//   segment gets label j; every other segment, and every sample of an arc,
//   gets 0. A ring without aligned vertex is therefore all 0: nothing
//   changes for it, and smooth surfaces still grow across its facets.
//
// vertexEdges lists the expanded point indices of the drawn vertices between
// two visible straight segments whose fold stays below
// VERTEX_EDGE_MAX_FOLD_DEG: the vertical edges an EdgesGeometry built at the
// crease threshold does not draw.

// Fold (degrees) under which two consecutive straight segments are aligned:
// their side faces are coplanar for every face reader (0.1° for the brush
// part index, ~0.57° + 0.1 mm for the plane sweep of getFaceRegion).
export const COLLINEAR_JUNCTION_DEG = 0.5;

// Crease threshold of the black outline (DEFAULT_CREASE_THRESHOLD_DEG).
export const VERTEX_EDGE_MAX_FOLD_DEG = 15;

const EMPTY = {
  points: [],
  hidden: new Set(),
  labels: [],
  vertexEdges: [],
  hasLabels: false,
};

function getFoldDeg(a, b) {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (!(la > 0) || !(lb > 0)) return Infinity;
  const cross = a.x * b.y - a.y * b.x;
  const dot = a.x * b.x + a.y * b.y;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

/**
 * @param {Array<{x:number, y:number, type?:string}>} ring - closed source
 *   ring (S-C-S arcs not expanded)
 * @param {Array<number>} [hiddenSegmentsIdx] - hidden source segments
 *   (segment i runs from point i to point i + 1)
 * @param {object} [options]
 * @param {number|Function} [options.samples] - per-half-arc sampling, as
 *   passed to expandRingWithOffsets
 * @returns {{points: Array, hidden: Set<number>, labels: Array<number>,
 *   vertexEdges: Array<number>, hasLabels: boolean}}
 */
export default function getPrismSideSegments(
  ring,
  hiddenSegmentsIdx = [],
  { samples = adaptiveArcSamples } = {}
) {
  const n = ring?.length ?? 0;
  if (n < 3) return EMPTY;

  const expanded = expandRingWithOffsets(
    ring.map((p, i) => ({ ...p, _sourceIndex: i })),
    samples,
    true
  );
  const m = expanded.length;
  // Anchors: the source points kept by the expansion (arc samples carry no
  // source index).
  const anchors = [];
  expanded.forEach((p, k) => {
    if (Number.isInteger(p._sourceIndex)) anchors.push(k);
  });
  const points = expanded.map((p) => {
    const copy = { ...p };
    delete copy._sourceIndex;
    return copy;
  });
  const count = anchors.length;
  if (count < 2) {
    return { ...EMPTY, points, labels: new Array(m).fill(0) };
  }

  const hiddenSource = new Set(hiddenSegmentsIdx ?? []);
  // Spans: the expanded segments between two consecutive anchors — one
  // straight source segment, or one sampled arc.
  const spans = anchors.map((start, j) => {
    const end = anchors[(j + 1) % count];
    const length = (end - start + m) % m || m;
    const source = expanded[start]._sourceIndex;
    const nextSource = expanded[end]._sourceIndex;
    const isArc = length > 1 || (nextSource - source + n) % n === 2;
    return {
      start,
      length,
      isArc,
      isHidden:
        hiddenSource.has(source) ||
        (isArc && hiddenSource.has((source + 1) % n)),
      direction: {
        x: expanded[end].x - expanded[start].x,
        y: expanded[end].y - expanded[start].y,
      },
    };
  });

  // Fold at the anchor opening span j (between span j - 1 and span j).
  const folds = spans.map((span, j) => {
    const previous = spans[(j - 1 + count) % count];
    if (span.isArc || previous.isArc) return Infinity;
    return getFoldDeg(previous.direction, span.direction);
  });
  const isAligned = (j) => folds[j] < COLLINEAR_JUNCTION_DEG;

  // Labels restart at every non-aligned junction: the walk starts on one so
  // a run straddling the ring closure is numbered in one go.
  const spanLabels = new Array(count).fill(0);
  const first = folds.findIndex((_, j) => !isAligned(j));
  if (first >= 0) {
    let label = 0;
    for (let step = 1; step < count; step++) {
      const j = (first + step) % count;
      label = isAligned(j) ? label + 1 : 0;
      spanLabels[j] = label;
    }
  }

  const hidden = new Set();
  const labels = new Array(m).fill(0);
  spans.forEach((span, j) => {
    for (let s = 0; s < span.length; s++) {
      const k = (span.start + s) % m;
      labels[k] = spanLabels[j];
      if (span.isHidden) hidden.add(k);
    }
  });

  const vertexEdges = [];
  spans.forEach((span, j) => {
    const previous = spans[(j - 1 + count) % count];
    if (span.isHidden || previous.isHidden) return;
    if (folds[j] < VERTEX_EDGE_MAX_FOLD_DEG) vertexEdges.push(span.start);
  });

  return {
    points,
    hidden,
    labels,
    vertexEdges,
    hasLabels: spanLabels.some((label) => label !== 0),
  };
}
