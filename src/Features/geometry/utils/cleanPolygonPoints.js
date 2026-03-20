/**
 * Clean polygon points by removing:
 * 1. Points that are too close together (below minDistance threshold)
 * 2. Points that are collinear (don't contribute to the shape)
 *
 * Unlike cleanPolylinePoints, this handles closed polygons (wrap-around).
 *
 * @param {Array} points - Array of point objects with {x, y, id, ...}
 * @param {Object} options - Configuration options
 * @param {number} options.minDistance - Minimum distance between consecutive points (default: 0.5)
 * @param {number} options.angleThreshold - Maximum angle deviation to consider collinear (radians, default: 0.05 ~2.9°)
 * @returns {Array} - Cleaned array of original point objects (preserves id, type, etc.)
 */
export default function cleanPolygonPoints(points, options = {}) {
  if (!Array.isArray(points) || points.length < 4) {
    return points;
  }

  const { minDistance = 0.5, angleThreshold = 0.05 } = options;

  const distance = (p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const calculateDeviation = (p1, p2, p3) => {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;

    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (mag1 === 0 || mag2 === 0) return Math.PI;

    const dot = dx1 * dx2 + dy1 * dy2;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.abs(Math.acos(cosAngle) - Math.PI);
  };

  // First pass: remove points too close to their neighbor (wrap-around)
  let filtered = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    if (filtered.length === 0) {
      filtered.push(current);
      continue;
    }
    const prev = filtered[filtered.length - 1];
    if (distance(prev, current) >= minDistance) {
      filtered.push(current);
    }
  }
  // Check wrap-around: last ↔ first
  if (
    filtered.length > 3 &&
    distance(filtered[filtered.length - 1], filtered[0]) < minDistance
  ) {
    filtered.pop();
  }

  if (filtered.length < 4) return filtered;

  // Second pass: remove collinear points (wrap-around)
  const kept = [];
  for (let i = 0; i < filtered.length; i++) {
    const prev = filtered[(i - 1 + filtered.length) % filtered.length];
    const current = filtered[i];
    const next = filtered[(i + 1) % filtered.length];

    const deviation = calculateDeviation(prev, current, next);
    if (deviation > angleThreshold) {
      kept.push(current);
    }
  }

  return kept.length >= 3 ? kept : filtered;
}
