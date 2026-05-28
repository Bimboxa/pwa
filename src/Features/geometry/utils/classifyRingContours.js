// Exterior-contour classification for a closed polygon ring.
//
// Shared, org-agnostic geometry: generic Features code and org-specific Data
// procedures both depend on this module rather than the reverse. The related
// foreign-edge helpers (signedArea2, buildForeignEdges,
// subdivideRingByForeignProjections) live alongside it in this folder.
//
// The ring is scanned in BOTH directions (forward + reversed) for "wall
// branches" — places where the contour dives in and comes back out within a
// characteristic wall distance. Those branches are split off as `int` chains;
// the remaining `ext` chains, stitched in order, form the exterior contour
// with the wall footprints bridged (filled).

export const WALL_DETECTION_M = 0.6; // characteristic distance to detect wall branches
const MIN_INDEX_DISTANCE = 2; // minimum index gap to consider two points non-adjacent
const START_POINT_MIN_SEG_M = 1; // min adjacent segment length (meters) for a valid scan start point
const COLINEAR_TOLERANCE_PX = 0.5;

/**
 * Forward index distance from i to j on a ring of size N.
 */
function forwardDist(i, j, N) {
  return (j - i + N) % N;
}

/**
 * Project point P onto segment [A, B]. Returns { dist, t, projPt } or null
 * when the projection falls outside the segment.
 */
function projectOntoSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return null;

  const t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  if (t < 0 || t > 1) return null;

  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return {
    dist: Math.hypot(px - projX, py - projY),
    t,
    projPt: { x: projX, y: projY },
  };
}

/**
 * Pick a scan start point on a convex part of the ring (both adjacent
 * segments longer than minSegPx), preferring the leftmost such point.
 * Falls back to the plain leftmost point.
 */
function findScanStartIdx(points, N, minSegPx) {
  let bestIdx = -1;
  let bestX = Infinity;
  for (let i = 0; i < N; i++) {
    const prev = (i - 1 + N) % N;
    const next = (i + 1) % N;
    const lenPrev = Math.hypot(
      points[i].x - points[prev].x,
      points[i].y - points[prev].y
    );
    const lenNext = Math.hypot(
      points[next].x - points[i].x,
      points[next].y - points[i].y
    );
    if (lenPrev >= minSegPx && lenNext >= minSegPx) {
      if (
        points[i].x < bestX ||
        (points[i].x === bestX &&
          points[i].y < (bestIdx >= 0 ? points[bestIdx].y : Infinity))
      ) {
        bestX = points[i].x;
        bestIdx = i;
      }
    }
  }

  if (bestIdx >= 0) return bestIdx;

  let startIdx = 0;
  for (let i = 1; i < N; i++) {
    if (
      points[i].x < points[startIdx].x ||
      (points[i].x === points[startIdx].x && points[i].y < points[startIdx].y)
    ) {
      startIdx = i;
    }
  }
  return startIdx;
}

/**
 * Scan a ring in one direction, detecting wall branch pairs. Walks from a
 * convex-hull start point; at each point scans ahead for a non-adjacent close
 * match (point-to-point or projection ≤ detectionPx).
 */
function scanForBranches(points, N, detectionPx, minSegPx = 0) {
  const startIdx = findScanStartIdx(points, N, minSegPx);

  const branches = [];
  let visited = 0;
  let cursor = startIdx;

  while (visited < N) {
    const ci = cursor;
    const pt = points[ci];
    const remaining = N - visited - 1;

    let match = null;
    if (remaining >= MIN_INDEX_DISTANCE) {
      for (let fwd = MIN_INDEX_DISTANCE; fwd <= remaining; fwd++) {
        const j = (ci + fwd) % N;

        // 1. point-to-point
        if (Math.hypot(pt.x - points[j].x, pt.y - points[j].y) <= detectionPx) {
          match = { type: "point", targetIdx: j, fwd };
          break;
        }

        // 2. projection onto segment [j, j+1]
        if (fwd + 1 > remaining) continue;
        const jn = (j + 1) % N;
        const proj = projectOntoSegment(
          pt.x,
          pt.y,
          points[j].x,
          points[j].y,
          points[jn].x,
          points[jn].y
        );
        if (proj && proj.dist <= detectionPx) {
          match = {
            type: "projection",
            segStartIdx: j,
            segEndIdx: jn,
            projPt: proj.projPt,
            fwd,
          };
          break;
        }
      }
    }

    if (match) {
      const intIndices = new Set();
      intIndices.add(ci); // green

      if (match.type === "point") {
        let w = (ci + 1) % N;
        while (w !== match.targetIdx) {
          intIndices.add(w);
          w = (w + 1) % N;
        }
        intIndices.add(match.targetIdx); // pink

        branches.push({
          entryIdx: ci,
          exitIdx: match.targetIdx,
          exitProjPt: null,
          exitContinueIdx: (match.targetIdx + 1) % N,
          intIndices,
        });

        visited += forwardDist(ci, match.targetIdx, N) + 1;
        cursor = (match.targetIdx + 1) % N;
      } else {
        let w = (ci + 1) % N;
        while (w !== match.segEndIdx) {
          intIndices.add(w);
          w = (w + 1) % N;
        }

        branches.push({
          entryIdx: ci,
          exitIdx: match.segStartIdx,
          exitProjPt: match.projPt,
          exitContinueIdx: match.segEndIdx,
          intIndices,
        });

        visited += forwardDist(ci, match.segStartIdx, N) + 1;
        cursor = match.segEndIdx;
      }
    } else {
      visited++;
      cursor = (ci + 1) % N;
    }
  }

  return branches;
}

/**
 * Convert a branch detected on a reversed ring to original ring indices.
 */
function convertReversedBranch(revBranch, N) {
  const origIntIndices = new Set();
  for (const idx of revBranch.intIndices) {
    origIntIndices.add(N - 1 - idx);
  }

  const origExitIdx = N - 1 - revBranch.entryIdx;

  if (revBranch.exitProjPt) {
    const origEntryIdx = N - 1 - revBranch.exitIdx;
    return {
      entryIdx: origEntryIdx,
      entryProjPt: revBranch.exitProjPt,
      entryPrevIdx: (origEntryIdx - 1 + N) % N,
      exitIdx: origExitIdx,
      exitProjPt: null,
      exitContinueIdx: (origExitIdx + 1) % N,
      intIndices: origIntIndices,
    };
  }

  const origEntryIdx = N - 1 - revBranch.exitIdx;
  return {
    entryIdx: origEntryIdx,
    entryProjPt: null,
    entryPrevIdx: null,
    exitIdx: origExitIdx,
    exitProjPt: null,
    exitContinueIdx: (origExitIdx + 1) % N,
    intIndices: origIntIndices,
  };
}

/**
 * Build ext/int chains from a sorted list of branches.
 */
function buildChainsFromBranches(points, N, branches, startIdx) {
  const extChains = [];
  const intChains = [];
  let currentExt = [];
  let cursor = startIdx;

  for (const branch of branches) {
    const walkTo = branch.entryProjPt ? branch.entryPrevIdx : branch.entryIdx;

    while (cursor !== walkTo) {
      currentExt.push(points[cursor].id);
      cursor = (cursor + 1) % N;
    }
    currentExt.push(points[walkTo].id);

    if (branch.entryProjPt) {
      currentExt.push(branch.entryProjPt);
    }
    if (currentExt.length >= 2) extChains.push(currentExt);

    const intChain = [];
    if (branch.entryProjPt) {
      intChain.push(branch.entryProjPt);
    }
    intChain.push(points[branch.entryIdx].id);
    let w = (branch.entryIdx + 1) % N;
    while (w !== branch.exitIdx) {
      intChain.push(points[w].id);
      w = (w + 1) % N;
    }
    intChain.push(points[branch.exitIdx].id);
    if (branch.exitProjPt) {
      intChain.push(branch.exitProjPt);
    }
    intChains.push(intChain);

    currentExt = branch.exitProjPt
      ? [branch.exitProjPt]
      : [points[branch.exitIdx].id];
    cursor = branch.exitContinueIdx;
  }

  while (cursor !== startIdx) {
    currentExt.push(points[cursor].id);
    cursor = (cursor + 1) % N;
  }
  currentExt.push(points[startIdx].id);

  if (extChains.length > 0) {
    extChains[0] = [...currentExt.slice(0, -1), ...extChains[0]];
  } else if (currentExt.length >= 2) {
    extChains.push(currentExt);
  }

  return { ext: extChains, int: intChains };
}

/**
 * Classify the vertices of a closed polygon outer ring into exterior (`ext`)
 * and wall-branch (`int`) contour chains. Runs branch detection in both ring
 * directions and merges the results.
 *
 * @param {Array<{x:number,y:number,id:string}>} points - ring in px coords
 * @param {number} meterByPx - scale factor (meters per pixel)
 * @returns {{ ext: Array<Array<string|{x,y}>>, int: Array<Array<string|{x,y}>> }}
 */
export function classifyRingContours(points, meterByPx) {
  const N = points.length;
  if (N < 3) return { ext: [points.map((p) => p.id)], int: [] };

  const detectionPx = WALL_DETECTION_M / meterByPx;
  const minSegPx = START_POINT_MIN_SEG_M / meterByPx;

  const startIdx = findScanStartIdx(points, N, minSegPx);

  const fwdBranches = scanForBranches(points, N, detectionPx, minSegPx);
  for (const b of fwdBranches) {
    b.entryProjPt = null;
    b.entryPrevIdx = null;
  }

  const revPoints = [...points].reverse();
  const bwdBranchesRev = scanForBranches(revPoints, N, detectionPx, minSegPx);
  const bwdBranches = bwdBranchesRev.map((b) => convertReversedBranch(b, N));

  const merged = [...fwdBranches];
  for (const bwd of bwdBranches) {
    const overlappingIndices = [];
    for (let mi = 0; mi < merged.length; mi++) {
      for (const idx of bwd.intIndices) {
        if (merged[mi].intIndices.has(idx)) {
          overlappingIndices.push(mi);
          break;
        }
      }
    }

    if (overlappingIndices.length === 0) {
      merged.push(bwd);
    } else {
      const isSuperset = overlappingIndices.every((mi) => {
        for (const idx of merged[mi].intIndices) {
          if (!bwd.intIndices.has(idx)) return false;
        }
        return true;
      });

      if (isSuperset) {
        for (let k = overlappingIndices.length - 1; k >= 0; k--) {
          merged.splice(overlappingIndices[k], 1);
        }
        merged.push(bwd);
      }
    }
  }

  if (merged.length === 0) {
    return { ext: [points.map((p) => p.id)], int: [] };
  }

  merged.sort(
    (a, b) =>
      forwardDist(startIdx, a.entryIdx, N) -
      forwardDist(startIdx, b.entryIdx, N)
  );

  return buildChainsFromBranches(points, N, merged, startIdx);
}

/**
 * Remove points that are colinear with their neighbours (within tolerance).
 */
function removeColinearPoints(chain) {
  if (chain.length <= 2) return chain;
  const result = [chain[0]];
  for (let i = 1; i < chain.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = chain[i];
    const next = chain[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
      result.push(curr);
      continue;
    }
    const dist =
      Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx) / len;
    if (dist > COLINEAR_TOLERANCE_PX) {
      result.push(curr);
    }
  }
  result.push(chain[chain.length - 1]);
  return result;
}

/**
 * Extract the exterior contour of a closed polygon ring as a single open
 * ring of {x,y} points (last != first), with wall footprints bridged/filled.
 *
 * @param {Array<{x:number,y:number,id:string}>} points - ring in px coords
 * @param {number} meterByPx - scale factor (meters per pixel)
 * @returns {Array<{x:number,y:number}>|null}
 */
export function extractExteriorRing(points, meterByPx) {
  if (!points || points.length < 3 || !(meterByPx > 0)) return null;

  const { ext } = classifyRingContours(points, meterByPx);

  const byId = {};
  for (const pt of points) byId[pt.id] = pt;
  const resolveChain = (chain) =>
    chain.map((entry) => (typeof entry === "string" ? byId[entry] : entry));

  // Concatenate ext chains end-to-end, skipping coincident shared points.
  const ring = [];
  for (const chain of ext.map(resolveChain)) {
    for (const pt of chain) {
      if (!pt) continue;
      if (ring.length > 0) {
        const last = ring[ring.length - 1];
        if (Math.abs(last.x - pt.x) < 0.01 && Math.abs(last.y - pt.y) < 0.01)
          continue;
      }
      ring.push({ x: pt.x, y: pt.y });
    }
  }

  // Drop a trailing point coincident with the first (keep ring open).
  while (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (
      Math.abs(first.x - last.x) < 0.01 &&
      Math.abs(first.y - last.y) < 0.01
    ) {
      ring.pop();
    } else {
      break;
    }
  }

  const cleaned = removeColinearPoints(ring);
  return cleaned.length >= 3 ? cleaned : null;
}
