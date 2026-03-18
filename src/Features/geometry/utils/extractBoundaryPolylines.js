import { nanoid } from "@reduxjs/toolkit";
import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";

/**
 * Find the contour vertex closest to a given coordinate.
 */
function findNearestVertexIndex(contour, coord) {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < contour.length; i++) {
    const dx = contour[i].x - coord.x;
    const dy = contour[i].y - coord.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Get ordered vertex indices along the contour from `from` to `to` (inclusive).
 * @param {boolean} clockwise - if true, walk with increasing indices
 */
function getPathIndices(n, from, to, clockwise) {
  const indices = [];
  let i = from;
  for (let step = 0; step <= n; step++) {
    indices.push(i);
    if (i === to) break;
    i = clockwise ? (i + 1) % n : (i - 1 + n) % n;
  }
  return indices;
}

/**
 * Compute the edge index between two adjacent contour vertices.
 * Edge i connects contour[i] → contour[(i+1)%n].
 */
function edgeIndex(a, b, n) {
  if (b === (a + 1) % n) return a;
  if (a === (b + 1) % n) return b;
  return -1;
}

/**
 * Compute minimum distance from a point to any segment of a polyline.
 */
function distanceToPolyline(point, polylineCoords) {
  let minDist = Infinity;
  for (let s = 0; s < polylineCoords.length - 1; s++) {
    const { distance } = projectPointOnSegment(
      point,
      polylineCoords[s],
      polylineCoords[s + 1]
    );
    if (distance < minDist) minDist = distance;
  }
  return minDist;
}

/**
 * Compute average distance of path interior vertices to a polyline.
 */
function avgDistToPolyline(contour, pathIndices, polylineCoords) {
  const inner = pathIndices.slice(1, -1);
  if (inner.length === 0) return 0;
  let total = 0;
  for (const idx of inner) {
    total += distanceToPolyline(contour[idx], polylineCoords);
  }
  return total / inner.length;
}

/**
 * Project a point onto the nearest segment of a polyline.
 */
function projectOntoPolyline(point, polylineCoords) {
  let best = null;
  for (let s = 0; s < polylineCoords.length - 1; s++) {
    const result = projectPointOnSegment(
      point,
      polylineCoords[s],
      polylineCoords[s + 1]
    );
    if (!best || result.distance < best.distance) {
      best = result;
    }
  }
  return best;
}

/**
 * Extract boundary polylines from a merged polygon contour, excluding segments
 * that overlap with existing polylines at shared connection points.
 *
 * @param {{ points: Array<{x,y,id}>, cuts: Array }} mergedPolygon
 * @param {Array<{
 *   sharedCoord: {x,y},
 *   offsetCoord: {x,y},
 *   polylineCoords: Array<{x,y}>
 * }>} connections - shared point / offset pairs with their polyline
 * @returns {Array<Array<{x,y,id}>>} Array of polyline point arrays
 */
export default function extractBoundaryPolylines(mergedPolygon, connections) {
  const contour = mergedPolygon.points;
  const n = contour.length;

  if (n < 3) return [];

  // No connections: return the full contour as a single closed polyline
  if (!connections || connections.length === 0) {
    return [contour.map((p) => ({ ...p }))];
  }

  // 1. For each connection, find excluded edges and blue dot replacements
  const excludedEdges = new Set();
  const vertexReplacements = new Map(); // offsetIdx → blue point

  for (const conn of connections) {
    const sharedIdx = findNearestVertexIndex(contour, conn.sharedCoord);
    const offsetIdx = findNearestVertexIndex(contour, conn.offsetCoord);

    if (sharedIdx === offsetIdx) continue;

    // Determine which direction (CW vs CCW) runs along the polyline
    const cwPath = getPathIndices(n, sharedIdx, offsetIdx, true);
    const ccwPath = getPathIndices(n, sharedIdx, offsetIdx, false);

    const cwDist = avgDistToPolyline(contour, cwPath, conn.polylineCoords);
    const ccwDist = avgDistToPolyline(contour, ccwPath, conn.polylineCoords);

    const excludedPath = cwDist <= ccwDist ? cwPath : ccwPath;

    // Mark edges along the excluded path
    for (let k = 0; k < excludedPath.length - 1; k++) {
      const eIdx = edgeIndex(excludedPath[k], excludedPath[k + 1], n);
      if (eIdx !== -1) excludedEdges.add(eIdx);
    }

    // Project the offset vertex onto the polyline → blue point
    const projection = projectOntoPolyline(contour[offsetIdx], conn.polylineCoords);
    if (projection) {
      vertexReplacements.set(offsetIdx, {
        x: projection.projectedPoint.x,
        y: projection.projectedPoint.y,
        id: nanoid(),
      });
    }
  }

  if (excludedEdges.size === 0) {
    return [contour.map((p) => ({ ...p }))];
  }

  // 2. Walk contour and collect runs of non-excluded edges

  // Find first excluded edge to start the walk just after it
  let firstExcluded = -1;
  for (let k = 0; k < n; k++) {
    if (excludedEdges.has(k)) {
      firstExcluded = k;
      break;
    }
  }

  const runs = []; // each run is an array of edge indices
  let currentRun = [];

  for (let step = 0; step < n; step++) {
    const eIdx = (firstExcluded + 1 + step) % n;
    if (!excludedEdges.has(eIdx)) {
      currentRun.push(eIdx);
    } else {
      if (currentRun.length > 0) {
        runs.push(currentRun);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  // 3. Convert runs of edges to polylines
  const polylines = [];

  for (const run of runs) {
    const points = [];

    // First vertex of the run
    const firstVtx = run[0];
    points.push(
      vertexReplacements.has(firstVtx)
        ? { ...vertexReplacements.get(firstVtx) }
        : { ...contour[firstVtx] }
    );

    // Subsequent vertices (end of each edge)
    for (const eIdx of run) {
      const nextVtx = (eIdx + 1) % n;
      points.push(
        vertexReplacements.has(nextVtx)
          ? { ...vertexReplacements.get(nextVtx) }
          : { ...contour[nextVtx] }
      );
    }

    if (points.length >= 2) {
      polylines.push(points);
    }
  }

  // 4. Also extract cuts as closed polylines (no connections applied to cuts)
  if (mergedPolygon.cuts) {
    for (const cut of mergedPolygon.cuts) {
      if (cut.points && cut.points.length >= 3) {
        polylines.push(cut.points.map((p) => ({ ...p })));
      }
    }
  }

  return polylines;
}
