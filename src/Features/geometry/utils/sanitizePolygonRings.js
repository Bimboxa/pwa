// Ring sanitization for POLYGON annotations: remove consecutive duplicate
// points from the outer ring and each cut ring, remapping the positional
// segment-index tags (hiddenSegmentsIdx, isExtEdgeSegmentsIdx,
// isIntEdgeSegmentsIdx) accordingly.
//
// Duplicate consecutive points create zero-length segments that trigger
// spurious wall branches in the ring scan of classifyRingContours (point i-1
// matches the duplicate at i+1 within the minimum index gap), which produced
// giant VCT/RTP annotations in the fromPolygonsToBim procedure.

// Explicit .js extension so the plain-node test harness
// (__test__fromPolygonsToBim.mjs) can import this module without a bundler.
import { typeOf } from "./arcSampling.js";

export const DUPLICATE_POINT_EPS_PX = 0.01; // consecutive ring points closer than this are duplicates

/**
 * Remove consecutive duplicate points (dist < DUPLICATE_POINT_EPS_PX) from a
 * ring, including the wrap pair (last kept == first kept).
 *
 * When one of a duplicate pair is an arc control point (type "circle"), the
 * circle-typed one is kept: downstream point refs re-emit type:"circle" and
 * colinear cleanup protects circle-adjacent points, so losing the circle flag
 * would silently flatten an arc.
 *
 * @returns {{ points: Array, changed: boolean, repr: number[]|null }}
 *   repr[oldIdx] = new index of the kept representative of each old point
 *   (needed to remap positional segment-index tags).
 */
export function dedupeRingPoints(points) {
  const N = points?.length ?? 0;
  if (N < 3) return { points, changed: false, repr: null };

  const kept = [];
  const repr = new Array(N);
  for (let i = 0; i < N; i++) {
    const p = points[i];
    const last = kept[kept.length - 1];
    if (
      last &&
      Math.hypot(p.x - last.x, p.y - last.y) < DUPLICATE_POINT_EPS_PX
    ) {
      // duplicate of previous kept point (handles runs of 3+)
      if (typeOf(p) === "circle" && typeOf(last) !== "circle") {
        kept[kept.length - 1] = p; // replace square twin by circle one
      }
      repr[i] = kept.length - 1;
      continue;
    }
    repr[i] = kept.length;
    kept.push(p);
  }

  // Wrap pair: last kept duplicates first kept
  if (kept.length >= 2) {
    const first = kept[0];
    const last = kept[kept.length - 1];
    if (
      Math.hypot(first.x - last.x, first.y - last.y) < DUPLICATE_POINT_EPS_PX
    ) {
      if (typeOf(last) === "circle" && typeOf(first) !== "circle")
        kept[0] = last;
      kept.pop();
      // every old index that mapped to the dropped slot now maps to 0
      for (let i = 0; i < N; i++) if (repr[i] === kept.length) repr[i] = 0;
    }
  }

  if (kept.length < 3 || kept.length === N) {
    return { points, changed: false, repr: null }; // degenerate or clean ring
  }
  return { points: kept, changed: true, repr };
}

/**
 * Remap positional segment-index tags after dedupeRingPoints. Segment s joins
 * old points s and (s+1)%oldN; it survives iff its endpoints map to distinct
 * kept points, and since dedup only removes points its new index is simply
 * repr[s].
 */
export function remapSegmentsIdx(segIdx, repr, oldN) {
  if (!segIdx?.length || !repr) return segIdx;
  const out = new Set();
  for (const s of segIdx) {
    if (s < 0 || s >= oldN) continue;
    const a = repr[s];
    if (a === repr[(s + 1) % oldN]) continue; // zero-length segment, tag dropped
    out.add(a);
  }
  return [...out];
}

/**
 * Return a non-mutating copy of a POLYGON annotation with consecutive
 * duplicate points removed from its outer ring and each cut ring, and the
 * positional segment tags remapped accordingly. Returns the SAME object when
 * nothing changes (common case), so clean inputs produce identical output.
 */
export default function sanitizePolygonRings(polygon) {
  const outer = dedupeRingPoints(polygon.points ?? []);
  let cutsChanged = false;
  const cuts = (polygon.cuts ?? []).map((cut) => {
    const r = dedupeRingPoints(cut.points ?? []);
    if (!r.changed) return cut;
    cutsChanged = true;
    const oldN = cut.points.length;
    return {
      ...cut,
      points: r.points,
      hiddenSegmentsIdx: remapSegmentsIdx(cut.hiddenSegmentsIdx, r.repr, oldN),
      isExtEdgeSegmentsIdx: remapSegmentsIdx(
        cut.isExtEdgeSegmentsIdx,
        r.repr,
        oldN
      ),
      isIntEdgeSegmentsIdx: remapSegmentsIdx(
        cut.isIntEdgeSegmentsIdx,
        r.repr,
        oldN
      ),
    };
  });

  if (!outer.changed && !cutsChanged) return polygon;

  const oldN = polygon.points.length;
  return {
    ...polygon,
    points: outer.points,
    hiddenSegmentsIdx: outer.changed
      ? remapSegmentsIdx(polygon.hiddenSegmentsIdx, outer.repr, oldN)
      : polygon.hiddenSegmentsIdx,
    isExtEdgeSegmentsIdx: outer.changed
      ? remapSegmentsIdx(polygon.isExtEdgeSegmentsIdx, outer.repr, oldN)
      : polygon.isExtEdgeSegmentsIdx,
    isIntEdgeSegmentsIdx: outer.changed
      ? remapSegmentsIdx(polygon.isIntEdgeSegmentsIdx, outer.repr, oldN)
      : polygon.isIntEdgeSegmentsIdx,
    ...(polygon.cuts ? { cuts } : {}),
  };
}
