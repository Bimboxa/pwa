// points = [{x,y,type},{x,y,type},...]
// Points can have type: "circle" or "square" (default)
// Square → Circle → Square pattern creates a circular arc
// cuts = [{points: [...]}, ...] - Array of cut polylines (holes) to subtract

/**
 * Get the type of a point (defaults to "square")
 */
function typeOf(p) {
  return p?.type === "circle" ? "circle" : "square";
}

/**
 * Calculate the circle from three points
 */
function circleFromThreePoints(p0, p1, p2) {
  const x1 = p0.x;
  const y1 = p0.y;
  const x2 = p1.x;
  const y2 = p1.y;
  const x3 = p2.x;
  const y3 = p2.y;

  // Determinant (twice the signed area of the triangle)
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  // If the area is ~0, the points are collinear → no unique circle
  if (Math.abs(d) < 1e-9) return null;

  const x1sq_y1sq = x1 * x1 + y1 * y1;
  const x2sq_y2sq = x2 * x2 + y2 * y2;
  const x3sq_y3sq = x3 * x3 + y3 * y3;

  const ux =
    (x1sq_y1sq * (y2 - y3) + x2sq_y2sq * (y3 - y1) + x3sq_y3sq * (y1 - y2)) / d;

  const uy =
    (x1sq_y1sq * (x3 - x2) + x2sq_y2sq * (x1 - x3) + x3sq_y3sq * (x2 - x1)) / d;

  const center = { x: ux, y: uy };
  const r = Math.hypot(x1 - ux, y1 - uy); // distance from center to any point

  return { center, r };
}

/**
 * Calculate angle from center to point (in radians)
 */
function angleFromCenter(center, point) {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

/**
 * Sample points along a circular arc and return them for shoelace calculation
 */
function sampleArcPoints(startPx, endPx, center, radius, isCW, samples = 10) {
  const angleStart = angleFromCenter(center, startPx);
  const angleEnd = angleFromCenter(center, endPx);

  const TWO_PI = Math.PI * 2;

  // Calculate raw difference
  let diff = angleEnd - angleStart;

  // Normalize diff based on desired direction (sweep)
  if (isCW) {
    // Clockwise: we need a positive angle delta (0 to 2PI)
    while (diff < 0) diff += TWO_PI;
    while (diff >= TWO_PI) diff -= TWO_PI;
  } else {
    // Counter-clockwise: we need a negative angle delta (0 to -2PI)
    while (diff > 0) diff -= TWO_PI;
    while (diff <= -TWO_PI) diff += TWO_PI;
  }

  // Determine if we should use the large arc
  const absDiff = Math.abs(diff);
  const useLargeArc = absDiff > Math.PI;

  // Calculate the actual angle span to use
  let angleSpan;
  if (useLargeArc) {
    // Large arc: use the complement
    angleSpan = TWO_PI - absDiff;
  } else {
    // Small arc: use the direct span
    angleSpan = absDiff;
  }

  // Sample points along the arc (not including start, including end)
  const arcPoints = [];
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    let angle;
    if (isCW) {
      angle = angleStart + t * (useLargeArc ? TWO_PI - angleSpan : angleSpan);
    } else {
      angle = angleStart - t * (useLargeArc ? TWO_PI - angleSpan : angleSpan);
    }
    // Normalize angle
    while (angle < 0) angle += TWO_PI;
    while (angle >= TWO_PI) angle -= TWO_PI;

    arcPoints.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return arcPoints;
}

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
