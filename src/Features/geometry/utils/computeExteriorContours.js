import {
  expandArcsInPath,
  extractArcCircles,
  arcUnitsToTypedPoints,
  typeOf,
} from "./arcSampling";
import collapseArcsInPolyline from "./collapseArcsInPolyline";
import buildForeignEdges from "./buildForeignEdges";
import splitChainsAtFrontierEdges from "./splitChainsAtFrontierEdges";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";

// Straight samples per S-C-S arc half before the frontier classification —
// same density as useWallBoundaries so collapseArcsInPolyline can re-fit the
// arcs on the stitched output.
const ARC_SAMPLES = 16;

// Consecutive vertices closer than this (px) are duplicates of the same corner.
const MIN_SEG_PX = 0.1;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dedupeConsecutive(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (dist(pts[i], out[out.length - 1]) > MIN_SEG_PX) out.push(pts[i]);
  }
  return out;
}

/**
 * Greedy nearest-endpoint stitching of open chains into closed rings.
 * Chains from adjacent polygons end at the corners flanking a dropped shared
 * (frontier) edge, so matching endpoints sit within tolPx of each other; the
 * two near-coincident corners are merged into one crisp junction vertex.
 * Each spatially connected cluster yields one ring.
 */
function stitchChainsIntoRings(chains, tolPx) {
  const pool = chains.map((c) => [...c]);
  const rings = [];

  while (pool.length) {
    const ring = pool.pop();

    for (;;) {
      const tail = ring[ring.length - 1];
      const closingDist = dist(tail, ring[0]);

      // Nearest endpoint among the remaining chains (either end).
      let best = null;
      for (let i = 0; i < pool.length; i++) {
        const chain = pool[i];
        const dHead = dist(tail, chain[0]);
        const dTail = dist(tail, chain[chain.length - 1]);
        const d = Math.min(dHead, dTail);
        if (!best || d < best.d) best = { idx: i, reversed: dTail < dHead, d };
      }

      // Close only when no remaining chain continues the ring more closely —
      // a tiny shared edge must not close the ring before absorbing the
      // neighbor's chains. The near-coincident tail is merged into the head
      // (closeLine bridges tail→head at render time).
      const canClose =
        ring.length >= 3 &&
        closingDist <= tolPx &&
        (!best || closingDist <= best.d);
      if (canClose) {
        ring[0] = { x: (ring[0].x + tail.x) / 2, y: (ring[0].y + tail.y) / 2 };
        ring.pop();
        rings.push(ring);
        break;
      }

      if (!best || best.d > tolPx) {
        // Dead end: forgive a slightly larger closing gap, else drop the scrap.
        if (ring.length >= 3 && closingDist <= 3 * tolPx) {
          ring[0] = {
            x: (ring[0].x + tail.x) / 2,
            y: (ring[0].y + tail.y) / 2,
          };
          ring.pop();
          rings.push(ring);
        } else {
          console.warn(
            `[computeExteriorContours] open scrap dropped (${ring.length} pts)`
          );
        }
        break;
      }

      const next = pool.splice(best.idx, 1)[0];
      if (best.reversed) next.reverse();
      // Junction endpoints are always original polygon corners (they flank a
      // dropped frontier edge), never arc circle-points — averaging is safe.
      ring[ring.length - 1] = {
        x: (tail.x + next[0].x) / 2,
        y: (tail.y + next[0].y) / 2,
      };
      ring.push(...next.slice(1));
    }
  }

  return rings;
}

/**
 * Exterior contour(s) of a set of polygon rings, fromPolygonsToBim-style:
 * sub-edges running along a neighbor ring within frontierPx are dropped
 * (shared limits), and the surviving exterior chains are stitched into closed
 * rings — one per spatially connected cluster. Interior rings (courtyards
 * enclosed by the selection) are discarded: exterior perimeter only.
 *
 * @param {Array<Array<{x,y,type?}>>} ringsPx - one typed exterior ring per
 *   polygon, pixel coords, S-C-S arcs as square/circle/square points
 * @param {{frontierPx: number}} options - shared-edge detection tolerance (px)
 * @returns {Array<Array<{x,y,type}>>} closed typed rings (first !== last)
 */
export default function computeExteriorContours(ringsPx, { frontierPx }) {
  const rings = (ringsPx ?? []).filter((r) => r?.length >= 3);
  if (rings.length === 0) return [];

  // Circles of every source S-C-S arc (WRAP arcs included) — provenance hints
  // so arcs surviving the frontier drop are re-fitted on the stitched output.
  const sourceArcCircles = [];
  const expandedRings = [];
  for (const ring of rings) {
    sourceArcCircles.push(...extractArcCircles(ring));
    expandedRings.push(
      dedupeConsecutive(expandArcsInPath(ring, ARC_SAMPLES, true))
    );
  }

  const openChains = [];
  const untouched = [];

  for (let i = 0; i < rings.length; i++) {
    const expanded = expandedRings[i];
    if (expanded.length < 3) continue;

    const foreignEdges = buildForeignEdges(
      expandedRings.map((pts) => ({ points: pts })),
      i
    );

    // Cyclic chain (first === last) as splitChainsAtFrontierEdges expects.
    const cyclicChain = [...expanded, expanded[0]];
    const { chains, removed } = splitChainsAtFrontierEdges(
      [cyclicChain],
      foreignEdges,
      frontierPx
    );

    if (!removed) {
      // No shared edge with any neighbor: emit the ORIGINAL typed ring
      // verbatim — arcs (incl. WRAP arcs) preserved, no collapse round-trip.
      untouched.push(
        rings[i].map((p) => ({ x: p.x, y: p.y, type: typeOf(p) }))
      );
      continue;
    }

    // Fully surrounded polygons contribute nothing (zero chains).
    openChains.push(...chains);
  }

  const stitched = stitchChainsIntoRings(openChains, Math.max(frontierPx, 1));

  // Re-fit arcs on each stitched ring. Rings start at a chain junction (a
  // square corner), so no arc straddles the seam.
  const collapsed = stitched
    .map((ringPts) => {
      const pts = dedupeConsecutive(ringPts);
      if (pts.length < 3) return null;
      const units = collapseArcsInPolyline(pts, {
        sourceArcCircles,
        requireSourceMatch: true,
      });
      if (units.length === 0) {
        return pts.map((p) => ({ x: p.x, y: p.y, type: "square" }));
      }
      return arcUnitsToTypedPoints(units);
    })
    .filter((r) => r && r.length >= 3);

  const allRings = [...untouched, ...collapsed];

  // Exterior perimeter only: drop any ring lying inside another one (e.g. the
  // courtyard ring of a donut-shaped selection). Containment is tested on
  // arc-expanded rings so bulging arcs are honored.
  const expandedForTest = allRings.map((r) => expandArcsInPath(r, 8, true));
  return allRings.filter((ring, i) => {
    const probe = expandedForTest[i][0];
    return !expandedForTest.some(
      (other, j) => j !== i && pointInPolygon(probe, other)
    );
  });
}
