import { findGuideEdgeForSubEdge } from "../../geometry/utils/classifyRingByGuideEdges.js";
import subdivideChainByForeignProjections from "../../geometry/utils/subdivideChainByForeignProjections.js";

// « Pinceau » on the lateral facet of a thick wall: the floor polygons glued
// to the foot of that facet, on its painted side — the runs of their ring
// sub-edges that lie along the facet's plan segment (the SURFACES_VERTICALES
// procedure's ring walk, seen from the wall: src/Data imports Features, never
// the reverse, so the walk is mirrored here).
//
// Pixel space (resolved annotations). Pure: node-testable, relative imports.
//
// guideEdges: [{ax, ay, bx, by, nx, ny, topZ}] — the facet's plan segments
//   (one per painted planar facet), (nx, ny) UNIT normal in px toward the
//   painted side, topZ the facet's top (base-map-local meters, absolute).
// polygons: [{id, baseZ, sloped, rings: [{kind: "MAIN"|"CUT", points}],
//   contains(pt), bottomAt(pt)}] — see collectGroundPolygonsFromScene;
//   bottomAt in the same z frame as topZ.
// tolPx: glue tolerance (0.05 m / meterByPx); probePx: side probe distance
//   (defaults to tolPx).
//
// Returns [{polygonId, baseZ, sloped, closeLine, topZ, points: [{x, y,
//   bottomZ, topZ}]}] — one run per contiguous stretch of matched sub-edges
//   of one ring (a gap-less ring is one closed run); a run breaks where the
//   facet top changes.

// A band thinner than this (m) is not a surface.
export const MIN_BAND_HEIGHT_M = 1e-3;
// Sub-edges shorter than this (px) are noise of the subdivision.
const MIN_SUB_EDGE_PX = 0.5;
const TOP_KEY_M = 1e-3;

// Even-odd point-in-ring test (ring without closing duplicate).
export function pointInRing(pt, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

// contains(pt) of a polygon given its rings: inside the MAIN ring, outside
// every CUT ring.
export function makeRingsContains(rings) {
  const main = rings.find((ring) => ring.kind === "MAIN")?.points ?? null;
  const cuts = rings
    .filter((ring) => ring.kind === "CUT")
    .map((ring) => ring.points);
  return (pt) => {
    if (!main || !pointInRing(pt, main)) return false;
    return !cuts.some((cut) => pointInRing(pt, cut));
  };
}

const topKey = (z) => Math.round(z / TOP_KEY_M);

function walkRing(ring, { guideEdges, polygon, tolPx, probePx }) {
  const points = ring.points;
  const n = points.length;
  if (n < 2) return [];
  const edgeCount = ring.closed === false ? n - 1 : n;

  // One slot per sub-edge span, in ring order: {from, to, topZ} or null.
  const slots = [];
  const classify = (p, q) => {
    if (Math.hypot(q.x - p.x, q.y - p.y) < MIN_SUB_EDGE_PX) return null;
    const edge = findGuideEdgeForSubEdge(p, q, guideEdges, tolPx);
    if (!edge) return null;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const probe = {
      x: mid.x + edge.nx * probePx,
      y: mid.y + edge.ny * probePx,
    };
    if (!polygon.contains(probe)) return null;
    if (edge.topZ - polygon.bottomAt(mid) <= MIN_BAND_HEIGHT_M) return null;
    return { topZ: edge.topZ };
  };

  for (let i = 0; i < edgeCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const chain = subdivideChainByForeignProjections([a, b], guideEdges, tolPx);
    let current = null;
    const flush = () => {
      if (current) slots.push(current);
      current = null;
    };
    for (let k = 0; k < chain.length - 1; k++) {
      const attrs = classify(chain[k], chain[k + 1]);
      if (!attrs) {
        flush();
        slots.push(null);
        continue;
      }
      if (current && topKey(current.topZ) === topKey(attrs.topZ)) {
        current.to = chain[k + 1];
      } else {
        flush();
        current = { from: chain[k], to: chain[k + 1], topZ: attrs.topZ };
      }
    }
    flush();
  }

  // Contiguous runs (cyclic ring: a gap-less ring is one closed run).
  const runs = [];
  const firstGap = slots.indexOf(null);
  if (firstGap < 0) {
    if (slots.length) runs.push({ segments: slots, closed: true });
  } else {
    const count = slots.length;
    let current = [];
    for (let k = 1; k <= count; k++) {
      const slot = slots[(firstGap + k) % count];
      if (slot) current.push(slot);
      else if (current.length) {
        runs.push({ segments: current, closed: false });
        current = [];
      }
    }
  }

  // Split a run where the facet top changes (one band per top).
  const out = [];
  for (const run of runs) {
    const groups = [];
    for (const segment of run.segments) {
      const last = groups[groups.length - 1];
      if (last && topKey(last.topZ) === topKey(segment.topZ)) {
        last.segments.push(segment);
      } else {
        groups.push({ topZ: segment.topZ, segments: [segment] });
      }
    }
    const closeLine = run.closed && groups.length === 1;
    if (run.closed && groups.length > 1) {
      // The cyclic start fell inside a group: re-join its two halves.
      const first = groups[0];
      const last = groups[groups.length - 1];
      if (topKey(first.topZ) === topKey(last.topZ)) {
        groups.pop();
        first.segments = [...last.segments, ...first.segments];
      }
    }
    for (const group of groups) {
      const pts = [group.segments[0].from];
      for (const segment of group.segments) pts.push(segment.to);
      if (closeLine) pts.pop();
      out.push({
        polygonId: polygon.id,
        baseZ: polygon.baseZ,
        sloped: Boolean(polygon.sloped),
        closeLine,
        topZ: group.topZ,
        points: pts.map((pt) => ({
          x: pt.x,
          y: pt.y,
          bottomZ: polygon.bottomAt(pt),
          topZ: group.topZ,
        })),
      });
    }
  }
  return out;
}

export default function matchWallFaceToGroundPolygons({
  guideEdges,
  polygons,
  tolPx,
  probePx = tolPx,
}) {
  if (!guideEdges?.length || !polygons?.length) return [];
  const runs = [];
  for (const polygon of polygons) {
    for (const ring of polygon.rings || []) {
      if (!(ring?.points?.length >= 2)) continue;
      runs.push(...walkRing(ring, { guideEdges, polygon, tolPx, probePx }));
    }
  }
  return runs;
}
