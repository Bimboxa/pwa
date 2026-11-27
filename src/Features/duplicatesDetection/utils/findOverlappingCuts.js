import polygonClipping from "polygon-clipping";

import { multiPolygonArea } from "../../geometry/utils/polygonsIntersectionArea.js";

import { cutToMultiPolygon, getBBox } from "./cutRings.js";

// PURE detection of the cuts (openings) of ONE polygon that overlap each
// other: the surface quantity subtracts every cut on its own, so a hole
// stored twice — or two holes sharing an area — comes off the surface twice.
//
// Two cuts overlap when their intersection covers at least `minOverlapPx²`
// AND `minCoverage` of the smaller one (two openings sharing a side, or
// overlapping by a sliver, are neighbours). Overlapping cuts are gathered in
// clusters (connected components); the over-counted area of a cluster is the
// sum of its cuts' areas minus the area of their union.
//
// Input: serialized annotations (pixel space, see
// serializeAnnotationsForDetection). Returns, biggest first: [{
//   annotationId, annotationTemplateId, type, layerId, cutsCount,
//   overCountedPx, clusters: [{ cutIds, overCountedPx }],
// }] — areas in px², `cutsCount` = cuts involved in a cluster.

const DEFAULT_MIN_COVERAGE = 0.05;

function bboxesIntersect(b1, b2) {
  return (
    b1.minX <= b2.maxX &&
    b2.minX <= b1.maxX &&
    b1.minY <= b2.maxY &&
    b2.minY <= b1.maxY
  );
}

function getIntersectionArea(a, b) {
  try {
    return multiPolygonArea(
      polygonClipping.intersection(a.multiPolygon, b.multiPolygon)
    );
  } catch {
    return 0;
  }
}

function getUnionArea(entries) {
  try {
    const [first, ...others] = entries.map((e) => e.multiPolygon);
    return multiPolygonArea(polygonClipping.union(first, ...others));
  } catch {
    return null;
  }
}

function findClusters(entries, { minOverlapArea, minCoverage }) {
  const parent = entries.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (!bboxesIntersect(a.bbox, b.bbox)) continue;
      const interArea = getIntersectionArea(a, b);
      if (interArea < minOverlapArea) continue;
      if (interArea / Math.min(a.area, b.area) < minCoverage) continue;
      parent[find(j)] = find(i);
    }
  }

  const byRoot = new Map();
  entries.forEach((entry, i) => {
    const root = find(i);
    const members = byRoot.get(root);
    if (members) members.push(entry);
    else byRoot.set(root, [entry]);
  });
  return [...byRoot.values()].filter((members) => members.length > 1);
}

export default function findOverlappingCuts(
  annotations,
  { minOverlapPx, minCoverage = DEFAULT_MIN_COVERAGE } = {}
) {
  const minOverlap =
    Number.isFinite(minOverlapPx) && minOverlapPx > 0 ? minOverlapPx : 1;
  const options = { minOverlapArea: minOverlap * minOverlap, minCoverage };

  const results = [];
  for (const annotation of annotations ?? []) {
    if (annotation?.type !== "POLYGON") continue;
    if (!Array.isArray(annotation.cuts) || annotation.cuts.length < 2) continue;

    const entries = [];
    annotation.cuts.forEach((cut, index) => {
      const multiPolygon = cutToMultiPolygon(cut);
      if (!multiPolygon) return;
      entries.push({
        cutId: cut.id ?? `cut::${index}`,
        multiPolygon,
        bbox: getBBox(multiPolygon),
        area: multiPolygonArea(multiPolygon),
      });
    });
    if (entries.length < 2) continue;

    const clusters = [];
    for (const members of findClusters(entries, options)) {
      const unionArea = getUnionArea(members);
      if (unionArea === null) continue;
      const sum = members.reduce((total, m) => total + m.area, 0);
      clusters.push({
        cutIds: members.map((m) => m.cutId),
        overCountedPx: Math.max(0, sum - unionArea),
      });
    }
    if (!clusters.length) continue;

    results.push({
      annotationId: annotation.id,
      annotationTemplateId: annotation.annotationTemplateId ?? null,
      type: annotation.type,
      layerId: annotation.layerId ?? null,
      cutsCount: clusters.reduce((n, c) => n + c.cutIds.length, 0),
      overCountedPx: clusters.reduce((n, c) => n + c.overCountedPx, 0),
      clusters,
    });
  }

  return results.sort((r1, r2) => r2.overCountedPx - r1.overCountedPx);
}
