import buildAnnotationEdgeRings from "Features/annotations/utils/buildAnnotationEdgeRings";
import findSharedEdgeChains from "Features/annotations/utils/findSharedEdgeChains";

import { TOTAL_COVERAGE } from "../constants/duplicatesDetectionConstants";

// PURE matcher of the duplicates detection (runs in the worker, or on the
// main thread as a fallback). Input: serialized candidates (see
// serializeAnnotationsForDetection), pixel space. Two annotations are
// duplicates when they share the same template (+ type) and a portion of
// their paths runs within `thresholdPx` of each other over more than
// `minOverlapPx` (findSharedEdgeChains: projected intervals, chains stitched
// along the ring). A crossing or a touching corner yields no chain.
//
// Returns {
//   pairs: [{ aId, bId, overlapPx }],
//   duplicates: [{ annotationId, annotationTemplateId, type, layerId,
//                  overlapPx, ownLengthPx, coverage, isTotal, partnerIds }],
//   stats: { candidates, groups, pairsChecked, pairs, durationMs },
// }

function segmentLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function ringLength(ring) {
  const pts = ring.points;
  const n = pts.length;
  const count = ring.closed ? n : n - 1;
  let length = 0;
  for (let i = 0; i < count; i += 1) {
    length += segmentLength(pts[i], pts[(i + 1) % n]);
  }
  return length;
}

function chainLength(chain) {
  let length = 0;
  for (let i = 1; i < chain.length; i += 1) {
    length += segmentLength(chain[i - 1], chain[i]);
  }
  return length;
}

// Bbox of the expanded ring points (arcs included), padded by the tolerance.
function getRingsBBox(rings, pad) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function bboxesIntersect(b1, b2) {
  return (
    b1.minX <= b2.maxX &&
    b2.minX <= b1.maxX &&
    b1.minY <= b2.maxY &&
    b2.minY <= b1.maxY
  );
}

// Length of `source` running along `other` (sum of the shared chains).
function getOverlapAlong(source, other, { thresholdPx, minOverlapPx }) {
  const chains = findSharedEdgeChains({
    sourceRings: source.rings,
    neighbors: [
      { annotation: { id: other.annotation.id }, rings: other.rings },
    ],
    thresholdPx,
    minChainLengthPx: minOverlapPx,
  });
  let overlap = 0;
  for (const { chain } of chains) overlap += chainLength(chain);
  return Math.min(overlap, source.ownLengthPx);
}

function getGroupKey(annotation, sameLayer) {
  const templateKey =
    annotation.annotationTemplateId ?? `TL:${annotation.type}`;
  const layerKey = sameLayer ? `|${annotation.layerId ?? "0"}` : "";
  return `${templateKey}|${annotation.type}${layerKey}`;
}

function recordDuplicate(byId, entry, partnerId, overlapPx, totalCoverage) {
  const { annotation, ownLengthPx } = entry;
  let dup = byId.get(annotation.id);
  if (!dup) {
    dup = {
      annotationId: annotation.id,
      annotationTemplateId: annotation.annotationTemplateId ?? null,
      type: annotation.type,
      layerId: annotation.layerId ?? null,
      overlapPx: 0,
      ownLengthPx,
      coverage: 0,
      isTotal: false,
      partnerIds: [],
    };
    byId.set(annotation.id, dup);
  }
  dup.partnerIds.push(partnerId);
  dup.overlapPx = Math.max(dup.overlapPx, overlapPx);
  dup.coverage = ownLengthPx > 0 ? dup.overlapPx / ownLengthPx : 0;
  dup.isTotal = dup.coverage >= totalCoverage;
}

export default function findOverlappingAnnotations(
  annotations,
  {
    thresholdPx,
    minOverlapPx,
    totalCoverage = TOTAL_COVERAGE,
    sameLayer = false,
  } = {}
) {
  const startedAt = Date.now();
  const threshold =
    Number.isFinite(thresholdPx) && thresholdPx > 0 ? thresholdPx : 1;
  const minOverlap =
    Number.isFinite(minOverlapPx) && minOverlapPx > 0
      ? minOverlapPx
      : 2 * threshold;

  // 1. rings + bbox + own length of every candidate
  const entries = [];
  for (const annotation of annotations ?? []) {
    const rings = buildAnnotationEdgeRings(annotation);
    if (!rings?.length) continue;
    const ownLengthPx = rings.reduce((sum, ring) => sum + ringLength(ring), 0);
    if (ownLengthPx <= 0) continue;
    entries.push({
      annotation,
      rings,
      bbox: getRingsBBox(rings, threshold),
      ownLengthPx,
    });
  }

  // 2. groups = same template (+ same layer when asked)
  const groups = new Map();
  for (const entry of entries) {
    const key = getGroupKey(entry.annotation, sameLayer);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  // 3. sweep on minX inside each group, 4. match the surviving pairs
  const pairs = [];
  const duplicatesById = new Map();
  let pairsChecked = 0;
  const options = { thresholdPx: threshold, minOverlapPx: minOverlap };

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((e1, e2) => e1.bbox.minX - e2.bbox.minX);
    for (let i = 0; i < group.length; i += 1) {
      const a = group[i];
      for (let j = i + 1; j < group.length; j += 1) {
        const b = group[j];
        if (b.bbox.minX > a.bbox.maxX) break;
        if (!bboxesIntersect(a.bbox, b.bbox)) continue;
        pairsChecked += 1;
        // measured both ways: the interval matcher samples the source edges,
        // so the longer of the two readings is the fairest overlap.
        const overlapPx = Math.max(
          getOverlapAlong(a, b, options),
          getOverlapAlong(b, a, options)
        );
        if (overlapPx <= 0) continue;
        pairs.push({ aId: a.annotation.id, bId: b.annotation.id, overlapPx });
        recordDuplicate(
          duplicatesById,
          a,
          b.annotation.id,
          overlapPx,
          totalCoverage
        );
        recordDuplicate(
          duplicatesById,
          b,
          a.annotation.id,
          overlapPx,
          totalCoverage
        );
      }
    }
  }

  // 5. one row per annotation, total duplicates first within a template
  const duplicates = [...duplicatesById.values()].sort((d1, d2) => {
    const t1 = d1.annotationTemplateId ?? "";
    const t2 = d2.annotationTemplateId ?? "";
    if (t1 !== t2) return t1 < t2 ? -1 : 1;
    if (d1.isTotal !== d2.isTotal) return d1.isTotal ? -1 : 1;
    return d2.overlapPx - d1.overlapPx;
  });

  return {
    pairs,
    duplicates,
    stats: {
      candidates: entries.length,
      groups: groups.size,
      pairsChecked,
      pairs: pairs.length,
      durationMs: Date.now() - startedAt,
    },
  };
}
