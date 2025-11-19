/**
 * Check if a closed polyline contains a cutHost polyline.
 * A closed polyline "contains" a cutHost if most/all points of the cutHost are inside the closed polyline.
 * 
 * @param {Array} cutHostPoints - Points of the cutHost polyline (relative coordinates 0-1)
 * @param {Array} closedPolylinePoints - Points of the closed polyline (relative coordinates 0-1)
 * @param {Object} imageSize - { w, h } - Image size in pixels for conversion
 * @returns {boolean} - True if the closed polyline contains the cutHost
 */
export default function doesPolylineCutClosedPolyline(
  cutHostPoints,
  closedPolylinePoints,
  imageSize
) {
  if (
    !Array.isArray(cutHostPoints) ||
    cutHostPoints.length < 2 ||
    !Array.isArray(closedPolylinePoints) ||
    closedPolylinePoints.length < 3
  ) {
    return false;
  }

  const w = imageSize?.w || imageSize?.width || 1;
  const h = imageSize?.h || imageSize?.height || 1;

  // Convert to pixel coordinates
  const cutHostPx = cutHostPoints.map((p) => ({
    x: (p.x ?? 0) * w,
    y: (p.y ?? 0) * h,
  }));

  const closedPx = closedPolylinePoints.map((p) => ({
    x: (p.x ?? 0) * w,
    y: (p.y ?? 0) * h,
  }));

  // Check if the closed polyline contains the cutHost
  // A closed polyline contains a cutHost if most/all points of the cutHost are inside it
  const pointsInside = cutHostPx.filter((p) =>
    isPointInPolygon(p, closedPx)
  );

  // If most points are inside, the closed polyline contains the cutHost
  // Require at least 50% of points to be inside (or all points for small polylines)
  // For very small polylines (2 points), require all points to be inside
  const threshold = cutHostPx.length <= 2 
    ? cutHostPx.length 
    : Math.max(1, Math.ceil(cutHostPx.length * 0.5));
  
  const contains = pointsInside.length >= threshold;
  
  // Debug logging (can be removed later)
  if (process.env.NODE_ENV === 'development') {
    console.log('[cutHost detection]', {
      cutHostPoints: cutHostPx.length,
      pointsInside: pointsInside.length,
      threshold,
      contains,
      closedPolylinePoints: closedPx.length
    });
  }
  
  return contains;
}

/**
 * Check if two line segments intersect
 */
function doSegmentsIntersect(p1, p2, p3, p4) {
  const d1 = crossProduct(p3, p4, p1);
  const d2 = crossProduct(p3, p4, p2);
  const d3 = crossProduct(p1, p2, p3);
  const d4 = crossProduct(p1, p2, p4);

  // Check if segments straddle each other
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  // Check for collinear cases (segments on same line)
  if (
    Math.abs(d1) < 1e-9 &&
    Math.abs(d2) < 1e-9 &&
    Math.abs(d3) < 1e-9 &&
    Math.abs(d4) < 1e-9
  ) {
    // Check if segments overlap
    return (
      (pointOnSegment(p1, p3, p4) ||
        pointOnSegment(p2, p3, p4) ||
        pointOnSegment(p3, p1, p2) ||
        pointOnSegment(p4, p1, p2))
    );
  }

  // Check endpoint intersections
  if (Math.abs(d1) < 1e-9 && pointOnSegment(p1, p3, p4)) return true;
  if (Math.abs(d2) < 1e-9 && pointOnSegment(p2, p3, p4)) return true;
  if (Math.abs(d3) < 1e-9 && pointOnSegment(p3, p1, p2)) return true;
  if (Math.abs(d4) < 1e-9 && pointOnSegment(p4, p1, p2)) return true;

  return false;
}

/**
 * Calculate cross product for three points
 */
function crossProduct(p1, p2, p3) {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

/**
 * Check if point p is on segment from p1 to p2
 */
function pointOnSegment(p, p1, p2) {
  const cross = Math.abs((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x));
  if (cross > 1e-9) return false; // Not collinear

  const dot = (p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y);
  const lenSq = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
  
  return dot >= 0 && dot <= lenSq;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

