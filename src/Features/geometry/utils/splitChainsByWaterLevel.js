import { findGuideEdgeForSubEdge } from "./classifyRingByGuideEdges.js";

// Heights are rounded before run-grouping so float noise never fragments a
// run into spurious single-segment VCT annotations.
const HEIGHT_ROUND = 1e4;

function roundHeight(h) {
  return Math.round(h * HEIGHT_ROUND) / HEIGHT_ROUND;
}

/**
 * Classify one sub-edge against the water level and return its emission
 * class, or null when the segment must be dropped (wall bottom at or above
 * the water level).
 *
 * The wall reference comes from the adjacent guide edge when one matches
 * (enriched with bottomZ / wallHeight), else from the polygon fallback.
 * Unknown wall height (all fallbacks null) is treated as an emerging wall:
 * capped at the water level, no RTP.
 */
function classifySegment(a, b, waterRel, guideEdges, tolPx, fallback) {
  const edge = guideEdges.length
    ? findGuideEdgeForSubEdge(a, b, guideEdges, tolPx)
    : null;
  const bottom = edge ? (edge.bottomZ ?? 0) : fallback.bottomZ;
  const wallHeight = (edge ? edge.wallHeight : null) ?? fallback.wallHeight;

  if (bottom >= waterRel) return null;
  if (wallHeight != null && bottom + wallHeight <= waterRel) {
    return { height: roundHeight(wallHeight), rtpEligible: true };
  }
  return { height: roundHeight(waterRel - bottom), rtpEligible: false };
}

function sameClass(c1, c2) {
  if (c1 === null || c2 === null) return c1 === c2;
  return c1.height === c2.height && c1.rtpEligible === c2.rtpEligible;
}

/**
 * Split exterior contour chains into constant-height runs against a water
 * level (cuvelage waterHeight option). Runs on the tessellated chains, BEFORE
 * the S-C-S arc re-fit (collapseChainArcs), so per-segment guide matching
 * sees plain segments; each returned run is re-fitted independently by the
 * caller.
 *
 * @param {Array<Array<{x,y}>>} chains - tessellated chains; a cyclic chain has
 *   chain[0] === chain[last] (same object reference)
 * @param {number|null} waterRel - water level relative to the baseMap
 *   (offsetZ space); null → strict passthrough (current behavior)
 * @param {Array<{ax,ay,bx,by,padPx?,bottomZ?,wallHeight?}>} guideEdges -
 *   enriched COTE:EXT guide edges (pixels); [] in non-guide mode
 * @param {number} tolPx - guide detection tolerance (pixels)
 * @param {number} fallbackBottomZ - wall bottom when no guide matches
 * @param {number|null} fallbackWallHeight - wall height when no guide matches
 * @param {number|null} passthroughHeight - height emitted verbatim when
 *   waterRel is null
 * @returns {{runs: Array<{chain, height, rtpEligible}>, splitOccurred: boolean}}
 *   `splitOccurred` is true when any segment was dropped or any chain yielded
 *   more than one run — a formerly closed ring can no longer auto-close.
 */
export default function splitChainsByWaterLevel({
  chains,
  waterRel,
  guideEdges,
  tolPx,
  fallbackBottomZ,
  fallbackWallHeight,
  passthroughHeight,
}) {
  if (waterRel == null) {
    return {
      runs: chains.map((chain) => ({
        chain,
        height: passthroughHeight,
        rtpEligible: true,
      })),
      splitOccurred: false,
    };
  }

  const fallback = {
    bottomZ: fallbackBottomZ ?? 0,
    wallHeight: fallbackWallHeight ?? null,
  };

  const runs = [];
  let splitOccurred = false;

  for (const chain of chains) {
    if (!chain || chain.length < 2) continue;

    const segClasses = [];
    for (let i = 0; i + 1 < chain.length; i++) {
      segClasses.push(
        classifySegment(
          chain[i],
          chain[i + 1],
          waterRel,
          guideEdges,
          tolPx,
          fallback
        )
      );
    }

    const allSame = segClasses.every((c) => sameClass(c, segClasses[0]));
    if (allSame) {
      if (segClasses[0] === null) {
        // whole chain above water → dropped
        splitOccurred = true;
        continue;
      }
      // uniform class → chain returned untouched (a cyclic chain keeps its
      // first === last convention, so closed rings survive with one height)
      runs.push({ chain, ...segClasses[0] });
      continue;
    }

    splitOccurred = true;

    const isCyclic = chain[0] === chain[chain.length - 1];
    if (isCyclic) {
      // Closed loop: split cyclically so a run can wrap across the seam.
      // Work on the unique vertices (same walk as the RTP mixed-height split).
      const V = chain.slice(0, chain.length - 1);
      const M = segClasses.length; // === V.length
      let start = 0;
      for (let i = 0; i < M; i++) {
        if (!sameClass(segClasses[i], segClasses[(i - 1 + M) % M])) {
          start = i;
          break;
        }
      }
      let i = 0;
      while (i < M) {
        const cls = segClasses[(start + i) % M];
        const runPoints = [V[(start + i) % M]];
        let j = i;
        while (j < M && sameClass(segClasses[(start + j) % M], cls)) {
          runPoints.push(V[(start + j + 1) % M]);
          j++;
        }
        if (cls !== null) runs.push({ chain: runPoints, ...cls });
        i = j;
      }
    } else {
      // Open chain: split linearly. Adjacent runs share their boundary point
      // objects (array slices), preserving intra-polygon point sharing.
      let runStart = 0;
      for (let i = 1; i <= segClasses.length; i++) {
        if (
          i === segClasses.length ||
          !sameClass(segClasses[i], segClasses[runStart])
        ) {
          const cls = segClasses[runStart];
          if (cls !== null) {
            runs.push({ chain: chain.slice(runStart, i + 1), ...cls });
          }
          runStart = i;
        }
      }
    }
  }

  return { runs, splitOccurred };
}
