/**
 * Cut a CLOSED polyline/strip at a given vertex — the pure part of the R2 step:
 * rotate the point refs so the cut vertex becomes the first point, and permute
 * every segment-indexed field accordingly (segment i = points[i] → points[i+1],
 * closing segment = n-1).
 *
 * The vertex ref is NOT duplicated here: the caller performs R1 by appending a
 * fresh db.points row sharing the first point's coordinates, then sets
 * closeLine to false — the segment count stays n so the permuted indices
 * remain valid.
 *
 * @param {Array<{id: string, type?: string}>} points - annotation.points refs
 * @param {number} vertexIndex - index of the cut vertex (must be a square ref)
 * @param {Object<string, number[]>} segmentIdxFields - segment-indexed fields
 *   to permute (e.g. { hiddenSegmentsIdx: [...], isoHeightSegmentsIdx: [...] })
 * @returns {{ points: Array, remappedFields: Object<string, number[]> }}
 */
export default function cutClosedPolylineAtVertex(
  points,
  vertexIndex,
  segmentIdxFields = {}
) {
  const n = points.length;
  const v = ((vertexIndex % n) + n) % n;

  const rotated = [...points.slice(v), ...points.slice(0, v)];

  const remappedFields = {};
  for (const [field, arr] of Object.entries(segmentIdxFields)) {
    if (!Array.isArray(arr)) continue;
    remappedFields[field] = arr
      .filter((i) => Number.isInteger(i) && i >= 0 && i < n)
      .map((i) => (((i - v) % n) + n) % n)
      .sort((a, b) => a - b);
  }

  return { points: rotated, remappedFields };
}
