/**
 * Orthogonally projects a point onto a line segment.
 *
 * @param {{ x: number, y: number }} point - The point to project
 * @param {{ x: number, y: number }} segStart - Segment start
 * @param {{ x: number, y: number }} segEnd - Segment end
 * @returns {{ projectedPoint: { x: number, y: number }, distance: number, t: number }}
 *   - projectedPoint: closest point on segment
 *   - distance: distance from point to projectedPoint
 *   - t: parameter [0,1] along the segment
 */
export default function projectPointOnSegment(point, segStart, segEnd) {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  // Degenerate segment (start === end)
  if (lenSq === 0) {
    const dist = Math.hypot(point.x - segStart.x, point.y - segStart.y);
    return { projectedPoint: { x: segStart.x, y: segStart.y }, distance: dist, t: 0 };
  }

  // Parameter t of the projection on the infinite line
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projectedPoint = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };

  const distance = Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y);

  return { projectedPoint, distance, t };
}
