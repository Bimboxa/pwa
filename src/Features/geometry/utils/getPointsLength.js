// points = [{x,y,type},{x,y,type},...]
// Points can have type: "circle" or "square" (default)
// Square → Circle → Square pattern creates a circular arc

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
 * Calculate arc length from start point to end point on a circle
 * This matches the logic in NodePolyline.jsx for determining large arc flag
 */
function getArcLength(startPx, endPx, center, radius, isCW) {
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
  // If the absolute angular travel is > PI, it's a large arc
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

  // Arc length = radius * angle (in radians)
  return radius * angleSpan;
}

/**
 * Get the type of a point (defaults to "square")
 */
function typeOf(p) {
  return p?.type === "circle" ? "circle" : "square";
}

export default function getPointsLength(points, closeLine = false) {
  if (!Array.isArray(points) || points.length < 2) return 0;

  const n = points.length;
  const idx = (i) => (closeLine ? (i + n) % n : i);
  const limit = closeLine ? n : n - 1;

  let length = 0;
  let i = 0;

  while (i < limit) {
    const i0 = idx(i);
    const i1 = idx(i + 1);
    const p0 = points[i0];
    const p1 = points[i1];
    const t0 = typeOf(p0);
    const t1 = typeOf(p1);

    if (!p0 || !p1) {
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
        // Open path: ran off the end, just draw a line to the first circle
        const dx = (p1.x ?? 0) - (p0.x ?? 0);
        const dy = (p1.y ?? 0) - (p0.y ?? 0);
        length += Math.hypot(dx, dy);
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
          // Cross product: in SVG (y-down), Cross > 0 is Clockwise
          const cross =
            (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
          const isCW = cross > 0;

          // Calculate arc lengths for both segments: P0→P1 and P1→P2
          const arcLength01 = getArcLength(p0, p1, circ.center, circ.r, isCW);
          const arcLength12 = getArcLength(p1, p2, circ.center, circ.r, isCW);

          length += arcLength01 + arcLength12;
          i += 2; // consumed S–C–S
          continue;
        } else {
          // Degenerate case: straight lines
          const dx1 = (p1.x ?? 0) - (p0.x ?? 0);
          const dy1 = (p1.y ?? 0) - (p0.y ?? 0);
          const dx2 = (p2.x ?? 0) - (p1.x ?? 0);
          const dy2 = (p2.y ?? 0) - (p1.y ?? 0);
          length += Math.hypot(dx1, dy1) + Math.hypot(dx2, dy2);
          i += 2;
          continue;
        }
      }

      // Generic case: S–C–…–C–S with > 1 circle in between
      // Use straight line segments between consecutive points
      let k = i;
      while (k < j) {
        const pk0 = points[idx(k)];
        const pk1 = points[idx(k + 1)];
        if (pk0 && pk1) {
          const dx = (pk1.x ?? 0) - (pk0.x ?? 0);
          const dy = (pk1.y ?? 0) - (pk0.y ?? 0);
          length += Math.hypot(dx, dy);
        }
        k += 1;
      }

      i = j;
      continue;
    }

    // Default: straight line segment
    const dx = (p1.x ?? 0) - (p0.x ?? 0);
    const dy = (p1.y ?? 0) - (p0.y ?? 0);
    length += Math.hypot(dx, dy);
    i += 1;
  }

  return length;
}
