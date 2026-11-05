import { adaptiveArcSamples, expandRingWithOffsets } from "./arcSampling.js";
import getBreakSegmentLabels, { getFoldDeg } from "./getBreakSegmentLabels.js";

// Side faces of the prism extruded from a closed ring (POLYGON with a height,
// footprint of a thick wall).
//
// The ring is expanded like the mesh builders do (expandRingWithOffsets, same
// arc sampling) and every EXPANDED segment (point k → point k + 1) gets:
//
// - hidden: its side face is not built. A straight source segment is hidden
//   when its index is in `hiddenSegmentsIdx`; an S-C-S arc is hidden as a
//   whole when either of its two source segments is (same rule as the
//   perimeter of getAnnotationQties).
// - label: face label of the run it belongs to between two BREAK points
//   (ring points flagged `isBreak`, see getBreakSegmentLabels). A ring
//   without break is all 0: nothing changes for it.
//
// breakPoints lists the breaks that stand between two visible side faces,
// as expanded point indices with their fold: the vertical edges to draw.

const EMPTY = {
  points: [],
  hidden: new Set(),
  labels: [],
  breakPoints: [],
  hasLabels: false,
};

/**
 * @param {Array<{x:number, y:number, type?:string, isBreak?:boolean}>} ring -
 *   closed source ring (S-C-S arcs not expanded)
 * @param {Array<number>} [hiddenSegmentsIdx] - hidden source segments
 *   (segment i runs from point i to point i + 1)
 * @param {object} [options]
 * @param {number|Function} [options.samples] - per-half-arc sampling, as
 *   passed to expandRingWithOffsets
 * @returns {{points: Array, hidden: Set<number>, labels: Array<number>,
 *   breakPoints: Array<{index: number, foldDeg: number}>,
 *   hasLabels: boolean}}
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
  // source index, and no `isBreak` either).
  const anchors = [];
  expanded.forEach((p, k) => {
    if (Number.isInteger(p._sourceIndex)) anchors.push(k);
  });
  const points = expanded.map((p) => {
    const copy = { ...p };
    delete copy._sourceIndex;
    return copy;
  });

  // Hidden: per span — the expanded segments between two consecutive
  // anchors, one straight source segment or one sampled arc.
  const hidden = new Set();
  const hiddenSource = new Set(hiddenSegmentsIdx ?? []);
  const count = anchors.length;
  if (hiddenSource.size > 0 && count >= 2) {
    anchors.forEach((start, j) => {
      const end = anchors[(j + 1) % count];
      const length = (end - start + m) % m || m;
      const source = expanded[start]._sourceIndex;
      const nextSource = expanded[end]._sourceIndex;
      const isArc = length > 1 || (nextSource - source + n) % n === 2;
      const isHidden =
        hiddenSource.has(source) ||
        (isArc && hiddenSource.has((source + 1) % n));
      if (!isHidden) return;
      for (let s = 0; s < length; s++) hidden.add((start + s) % m);
    });
  }

  const { labels, breaks, hasLabels } = getBreakSegmentLabels(points, {
    closed: true,
  });
  const breakPoints = breaks
    .filter((k) => !hidden.has(k) && !hidden.has((k - 1 + m) % m))
    .map((k) => ({ index: k, foldDeg: getFoldDeg(points, k, true) }));

  return { points, hidden, labels, breakPoints, hasLabels };
}
