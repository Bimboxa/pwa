import polygonClipping from "polygon-clipping";

import {
  expandArcsInPathWithHiddenMap,
  expandRingWithOffsets,
  typeOf,
} from "../../geometry/utils/arcSampling.js";
import getPolylineOutsidePolygons from "../../geometry/utils/getPolylineOutsidePolygons.js";

import { SEGMENT_FLAG_FIELDS } from "./segmentFlags.js";

// Tessellation count for S-C-S arcs — matches getAnnotationAsPolygons.
const ARC_SAMPLES = 16;

const toRing = (points) => {
  const ring = (points ?? []).map((p) => [p.x, p.y]);
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

const toGeom = (shape) => [
  toRing(shape.points),
  ...(shape.cuts ?? [])
    .map((c) => toRing(c.points))
    .filter((r) => r.length >= 4),
];

const chainLength = (points) => {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].y - points[i].y
    );
  }
  return length;
};

const lerp = (a, b, t) =>
  (Number(a) || 0) + ((Number(b) || 0) - (Number(a) || 0)) * t;

/**
 * « Évider » of a POLYLINE / STRIP: its CENTERLINE (the annotation points,
 * whatever the stroke / band width) is clipped by the footprints of the
 * cutting annotations; what lies under a footprint is removed, the remaining
 * chains become as many open lines. The cut falls exactly on the footprint
 * edge (no margin).
 *
 * A line with S-C-S arcs is tessellated first: its pieces carry no arc
 * (same rule as splitAnnotationsByContourService).
 *
 * Pure. `annotation` is pixel-resolved (useAnnotationsV2), `footprints` are
 * {points, cuts} polygons in the same space (getHollowOutCutterFootprints).
 *
 * @returns {null | {
 *   chains: Array<{points, segmentFlags}>,  longest first
 *   pieces: Array<{points, cuts: []}>,       same chains, preview shape
 *   consumed: boolean,
 * }} null when no footprint removes anything. In a chain, original vertices
 * keep their id; cut points have none and carry the offsetBottom / offsetTop
 * interpolated along their source segment. `segmentFlags` maps each segment
 * flag idx field to the flagged segment indices of the chain.
 */
export default function getHollowOutPolylineCarve({ annotation, footprints }) {
  const sourcePoints = annotation?.points ?? [];
  if (sourcePoints.length < 2) return null;
  const shapes = (footprints ?? []).filter((s) => s?.points?.length >= 3);
  if (shapes.length === 0) return null;

  const closed = annotation.closeLine === true;

  // Effective segment indices of the resolved annotation (useAnnotationsV2),
  // translated through the arc expansion when there is one.
  let points = sourcePoints;
  const flagsIdx = {};
  const hasArcs = sourcePoints.some((p) => typeOf(p) === "circle");
  for (const { idxField } of SEGMENT_FLAG_FIELDS) {
    const idx = annotation[idxField];
    if (!Array.isArray(idx) || idx.length === 0) continue;
    flagsIdx[idxField] = hasArcs
      ? expandArcsInPathWithHiddenMap(sourcePoints, ARC_SAMPLES, idx, closed)
          .hiddenSegmentsIdx
      : idx;
  }
  if (hasArcs)
    points = expandRingWithOffsets(sourcePoints, ARC_SAMPLES, closed);

  let multiPolygon;
  try {
    const [first, ...rest] = shapes.map((shape) => [toGeom(shape)]);
    multiPolygon = polygonClipping.union(first, ...rest);
  } catch (e) {
    console.error("getHollowOutPolylineCarve error:", e);
    return null;
  }

  const clipped = getPolylineOutsidePolygons(points, multiPolygon, { closed });
  if (!clipped) return null;

  const chains = clipped.chains
    .map((chain) => {
      const chainPoints = chain.points.map((p) => {
        if (p.t == null) return p;
        const a = points[p.srcSegIdx];
        const b = points[(p.srcSegIdx + 1) % points.length];
        return {
          x: p.x,
          y: p.y,
          offsetBottom: lerp(a?.offsetBottom, b?.offsetBottom, p.t),
          offsetTop: lerp(a?.offsetTop, b?.offsetTop, p.t),
        };
      });
      const segmentFlags = {};
      for (const [idxField, idx] of Object.entries(flagsIdx)) {
        const flagged = new Set(idx);
        const remapped = [];
        chain.srcSegIdx.forEach((srcIdx, i) => {
          if (flagged.has(srcIdx)) remapped.push(i);
        });
        if (remapped.length > 0) segmentFlags[idxField] = remapped;
      }
      return { points: chainPoints, segmentFlags };
    })
    .sort((c1, c2) => chainLength(c2.points) - chainLength(c1.points));

  return {
    chains,
    pieces: chains.map((chain) => ({ points: chain.points, cuts: [] })),
    consumed: clipped.consumed,
  };
}
