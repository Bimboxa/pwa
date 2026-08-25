import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";

// Auto-attach an annotation to one of the photoPlans of its photo baseMap:
// the annotation's centroid (vertex mean, arcs tessellated) must fall inside
// the plan's source polygon (holes excluded). Nested / overlapping source
// polygons -> the smallest ring area wins.
//
// `points`: the annotation's PIXEL-resolved points.
// `candidates`: [{ plan, ringPx, holesPx }] — the photoPlans of the baseMap
// with their source polygon resolved once per run by the caller.
//
// Returns the winning candidate or null.

const ARC_SAMPLES = 8;

const ringArea = (ring) => {
  let s2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s2) / 2;
};

export default function getPhotoPlanAttachment({ points, candidates }) {
  if (!points?.length || !candidates?.length) return null;

  const expanded = expandArcsInPath(points, ARC_SAMPLES, true);
  if (!expanded.length) return null;
  const centroid = {
    x: expanded.reduce((s, p) => s + p.x, 0) / expanded.length,
    y: expanded.reduce((s, p) => s + p.y, 0) / expanded.length,
  };

  let best = null;
  let bestArea = Infinity;
  for (const candidate of candidates) {
    const { ringPx, holesPx } = candidate;
    if (!ringPx || ringPx.length < 3) continue;
    if (!pointInPolygon(centroid, ringPx)) continue;
    if ((holesPx ?? []).some((h) => pointInPolygon(centroid, h))) continue;
    const area = ringArea(ringPx);
    if (area < bestArea) {
      best = candidate;
      bestArea = area;
    }
  }
  return best;
}
