import { nanoid } from "@reduxjs/toolkit";

/**
 * Resolve a snap point to a vertex index, optionally creating a new point
 * if it's a projection (i.e. not an existing vertex).
 *
 * @param {Array<{id: string}>} points - annotation points
 * @param {object} snapInfo - { type: 'VERTEX'|'PROJECTION', vertexIndex?, segmentIndex?, x, y, pointId? }
 * @param {boolean} closeLine
 * @returns {{ index: number, newPoint?: {id, x, y}, updatedPoints: Array }}
 */
function resolveSnapToIndex(points, snapInfo, closeLine) {
  if (snapInfo.type === "VERTEX") {
    return { index: snapInfo.vertexIndex, updatedPoints: points };
  }

  // PROJECTION: insert a new point on the segment
  const newPointId = nanoid();
  const newPoint = { id: newPointId, x: snapInfo.x, y: snapInfo.y };
  const insertAfter = snapInfo.segmentIndex;
  const updated = [
    ...points.slice(0, insertAfter + 1),
    { id: newPointId },
    ...points.slice(insertAfter + 1),
  ];
  return {
    index: insertAfter + 1,
    newPoint,
    updatedPoints: updated,
  };
}

/**
 * Split a polyline by removing the section between two snap points.
 *
 * - Open polyline: removes the middle section. Returns piece1 (start→p1) and piece2 (p2→end).
 * - Closed polyline: splits into 2 open polylines at the 2 cut points.
 *
 * @param {Array<{id: string}>} points - annotation.points array (refs only: {id})
 * @param {object} snap1 - first snap info: { type, vertexIndex?, segmentIndex?, x, y, pointId? }
 * @param {object} snap2 - second snap info
 * @param {boolean} closeLine - whether the polyline is closed
 * @returns {{ piece1: Array, piece2: Array, newPoints: Array<{id, x, y}> } | null}
 */
export default function splitPolylineBetweenPoints(
  points,
  snap1,
  snap2,
  closeLine
) {
  if (!points || points.length < 2) return null;

  const newPoints = [];

  // Resolve snap1 first, then snap2 on the (potentially updated) points array
  let currentPoints = [...points];

  const res1 = resolveSnapToIndex(currentPoints, snap1, closeLine);
  currentPoints = res1.updatedPoints;
  if (res1.newPoint) newPoints.push(res1.newPoint);

  // If snap1 was a projection insertion, snap2's segmentIndex may have shifted
  let adjustedSnap2 = { ...snap2 };
  if (
    res1.newPoint &&
    snap2.type === "PROJECTION" &&
    snap2.segmentIndex >= snap1.segmentIndex
  ) {
    adjustedSnap2 = {
      ...snap2,
      segmentIndex: snap2.segmentIndex + 1,
    };
  }
  if (
    res1.newPoint &&
    snap2.type === "VERTEX" &&
    snap2.vertexIndex > snap1.segmentIndex
  ) {
    adjustedSnap2 = {
      ...snap2,
      vertexIndex: snap2.vertexIndex + 1,
    };
  }

  const res2 = resolveSnapToIndex(currentPoints, adjustedSnap2, closeLine);
  currentPoints = res2.updatedPoints;
  if (res2.newPoint) newPoints.push(res2.newPoint);

  let idx1 = res1.index;
  let idx2 = res2.index;
  // Adjust idx1 if snap2 insertion shifted it
  if (res2.newPoint && res2.index <= idx1) {
    idx1 += 1;
  }

  if (idx1 === idx2) return null; // same point

  if (closeLine) {
    // Closed polyline: 2 cut points create 2 open pieces
    const n = currentPoints.length;
    const lo = Math.min(idx1, idx2);
    const hi = Math.max(idx1, idx2);

    // piece1: from lo to hi (inclusive)
    const piece1 = currentPoints.slice(lo, hi + 1);

    // piece2: from hi to lo wrapping around (inclusive)
    const piece2 = [];
    for (let i = 0; i <= n - hi + lo; i++) {
      piece2.push(currentPoints[(hi + i) % n]);
    }

    if (piece1.length < 2 || piece2.length < 2) return null;

    return { piece1, piece2, newPoints };
  }

  // Open polyline: remove middle section between the two points
  const lo = Math.min(idx1, idx2);
  const hi = Math.max(idx1, idx2);

  const piece1 = currentPoints.slice(0, lo + 1);
  const piece2 = currentPoints.slice(hi);

  if (piece1.length < 2 && piece2.length < 2) return null;

  // If one piece has <2 points, it's not a valid polyline — only return the other
  if (piece1.length < 2) {
    return { piece1: piece2, piece2: null, newPoints };
  }
  if (piece2.length < 2) {
    return { piece1, piece2: null, newPoints };
  }

  return { piece1, piece2, newPoints };
}
