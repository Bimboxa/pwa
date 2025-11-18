/**
 * Clean polyline points by removing:
 * 1. Points that are too close together (below minDistance threshold)
 * 2. Points that are collinear (don't contribute to the shape - essentially in the middle of two other points)
 *
 * @param {Array} points - Array of point objects with {x, y} or arrays [x, y]
 * @param {Object} options - Configuration options
 * @param {number} options.minDistance - Minimum distance between points (default: 0.001, normalized coordinates)
 * @param {number} options.angleThreshold - Maximum angle deviation to consider collinear (in radians, default: ~0.01 rad = ~0.57°)
 * @returns {Array} - Cleaned array of points
 */
export default function cleanPolylinePoints(points, options = {}) {
  if (!Array.isArray(points) || points.length < 3) {
    return points;
  }

  const {
    minDistance = 0.001, // Default for normalized coordinates (0-1 range)
    angleThreshold = 0.01, // ~0.57 degrees in radians
  } = options;

  // Normalize points to {x, y} format
  const normalizedPoints = points.map((p) => {
    if (Array.isArray(p)) {
      return { x: p[0], y: p[1] };
    }
    return { x: p.x, y: p.y };
  });

  const cleaned = [];

  // Helper: calculate distance between two points
  const distance = (p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper: calculate angle at point p2 between p1-p2-p3
  // Returns the angle in radians (0 = collinear, π = 180° turn)
  const calculateAngle = (p1, p2, p3) => {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;

    const dot = dx1 * dx2 + dy1 * dy2;
    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (mag1 === 0 || mag2 === 0) return Math.PI; // If zero length, consider it a turn

    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle);
  };

  // First pass: remove points that are too close together
  let filteredByDistance = [];
  for (let i = 0; i < normalizedPoints.length; i++) {
    const current = normalizedPoints[i];

    if (filteredByDistance.length === 0) {
      // Always keep the first point
      filteredByDistance.push(current);
      continue;
    }

    const last = filteredByDistance[filteredByDistance.length - 1];
    const dist = distance(last, current);

    // Keep point if it's far enough from the previous one
    if (dist >= minDistance) {
      filteredByDistance.push(current);
    }
  }

  if (filteredByDistance.length < 3) {
    return filteredByDistance;
  }

  // Second pass: remove collinear points (points that don't contribute to shape)
  cleaned.push(filteredByDistance[0]); // Always keep first point

  for (let i = 1; i < filteredByDistance.length - 1; i++) {
    const prev = filteredByDistance[i - 1];
    const current = filteredByDistance[i];
    const next = filteredByDistance[i + 1];

    const angle = calculateAngle(prev, current, next);
    const deviation = Math.abs(angle - Math.PI); // Deviation from 180° (straight line)

    // Keep point if angle deviates significantly from 180° (not collinear)
    // Or if it's close enough to the previous point (already handled in first pass, but double-check)
    if (deviation > angleThreshold) {
      cleaned.push(current);
    }
  }

  cleaned.push(filteredByDistance[filteredByDistance.length - 1]); // Always keep last point

  return cleaned;
}
