// points = [{x,y,type},{x,y,type},...]
// Points can have type: "circle" or "square" (default)
// Square → Circle → Square pattern creates a circular arc
// cuts = [{points: [...]}, ...] - Array of cut polylines (holes) to subtract

import { typeOf, circleFromThreePoints, sampleArcPoints } from "./arcSampling";

/**
 * Calculate surface area of a polygon, taking into account circular arcs
 * and optionally subtracting cuts (holes)
 */
export default function getPointsSurface(points, closeLine = true, cuts = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  const n = points.length;
  const idx = (i) => (closeLine ? (i + n) % n : i);
  const limit = closeLine ? n : n - 1;

  // Build expanded points array with arc samples
  const expandedPoints = [];
  let i = 0;

  while (i < limit) {
    const i0 = idx(i);
    const i1 = idx(i + 1);
    const p0 = points[i0];
    const p1 = points[i1];
    const t0 = typeOf(p0);
    const t1 = typeOf(p1);

    if (!p0 || !p1) {
      expandedPoints.push(p0 || p1);
      i += 1;
      continue;
    }

    // Check for S–C–S pattern (square → circle → square)
    if (t0 === "square" && t1 === "circle") {
      // Find the next square after one or more circle points
      let j = i + 1;
      while (j < i + n && typeOf(points[idx(j)]) === "circle") j += 1;
      const i2 = idx(j);

      if (!closeLine && j >= n) {
        // Open path: ran off the end, just use straight line
        expandedPoints.push(p0);
        i += 1;
        continue;
      }

      // Check if we have exactly one circle between two squares (S–C–S)
      if (j === i + 2 && typeOf(points[i2]) === "square") {
        const p2 = points[i2];

        // Calculate circle from three points
        const circ = circleFromThreePoints(p0, p1, p2);

        if (circ && Number.isFinite(circ.r) && circ.r > 0) {
          // Determine winding order (CW vs CCW)
          const cross =
            (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
          const isCW = cross > 0;

          // Add start point
          expandedPoints.push(p0);

          // Sample and add points along first arc: P0→P1
          const arcPoints01 = sampleArcPoints(
            p0,
            p1,
            circ.center,
            circ.r,
            isCW
          );
          expandedPoints.push(...arcPoints01);

          // Sample and add points along second arc: P1→P2
          const arcPoints12 = sampleArcPoints(
            p1,
            p2,
            circ.center,
            circ.r,
            isCW
          );
          expandedPoints.push(...arcPoints12);

          i += 2; // consumed S–C–S
          continue;
        } else {
          // Degenerate case: straight lines
          expandedPoints.push(p0);
          expandedPoints.push(p1);
          i += 2;
          continue;
        }
      }

      // Generic case: S–C–…–C–S with > 1 circle in between
      // Use straight line segments between consecutive points
      let k = i;
      while (k <= j && k < n) {
        const pk = points[idx(k)];
        if (pk) {
          expandedPoints.push(pk);
        }
        k += 1;
      }

      i = j;
      continue;
    }

    // Default: straight line segment - add the point
    expandedPoints.push(p0);
    i += 1;
  }

  if (expandedPoints.length < 3) return 0;

  // Calculate surface using shoelace formula on expanded points
  let surface = 0;
  const expN = expandedPoints.length;
  // For closed polygon, shoelace formula automatically wraps with modulo
  const actualN = closeLine ? expN : expN - 1;

  for (let i = 0; i < actualN; i++) {
    const current = expandedPoints[i];
    const nextIdx = closeLine ? (i + 1) % expN : i + 1;
    const next = expandedPoints[nextIdx];
    if (!current || !next) continue;

    const cx = current.x ?? 0;
    const cy = current.y ?? 0;
    const nx = next.x ?? 0;
    const ny = next.y ?? 0;

    surface += cx * ny - nx * cy;
  }

  const mainSurface = Math.abs(surface) / 2;

  // Subtract cuts (holes) if provided
  let cutsSurface = 0;
  if (Array.isArray(cuts) && cuts.length > 0) {
    for (const cut of cuts) {
      if (cut && Array.isArray(cut.points) && cut.points.length >= 3) {
        const cutCloseLine = cut.closeLine !== false; // Default to closed
        const cutSurface = getPointsSurface(cut.points, cutCloseLine, []); // Don't nest cuts
        cutsSurface += cutSurface;
      }
    }
  }

  // Return main surface minus cuts surface
  return Math.max(0, mainSurface - cutsSurface);
}
