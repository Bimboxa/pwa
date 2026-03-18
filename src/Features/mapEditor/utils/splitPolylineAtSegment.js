/**
 * Split a polyline/strip annotation by removing a segment (edge between two consecutive vertices).
 *
 * @param {Array<{id: string}>} points - annotation.points array
 * @param {number} segmentIndex - index of the segment to cut (segment between points[i] and points[i+1])
 * @param {boolean} closeLine - whether the annotation is a closed polyline
 * @returns {{ piece1: Array, piece2?: Array } | null}
 *   - Open polyline: { piece1, piece2 } — two pieces (before and after the removed segment)
 *   - Closed polyline: { piece1 } — single open piece with the gap at the cut segment
 *   - null if cut is not possible
 */
export default function splitPolylineAtSegment(points, segmentIndex, closeLine) {
  if (!points || points.length < 2) return null;

  const n = points.length;

  if (closeLine) {
    // Closed polyline: remove the segment to open it.
    // Segment i connects points[i] and points[(i+1) % n].
    // Result: reorder points so they start at (i+1) and end at i.
    if (n < 3) return null;
    const startIdx = (segmentIndex + 1) % n;
    const reordered = [];
    for (let k = 0; k < n; k++) {
      reordered.push(points[(startIdx + k) % n]);
    }
    return { piece1: reordered };
  }

  // Open polyline: split into two pieces by removing the segment.
  // Segment i connects points[i] and points[i+1].
  if (segmentIndex < 0 || segmentIndex >= n - 1) return null;
  if (n < 3) return null; // need at least 3 points to produce two non-empty pieces

  const piece1 = points.slice(0, segmentIndex + 1);
  const piece2 = points.slice(segmentIndex + 1);

  // Both pieces must have at least 1 point (guaranteed by checks above),
  // but a single point isn't a valid polyline.
  if (piece1.length < 2 && piece2.length < 2) return null;

  return { piece1, piece2 };
}
