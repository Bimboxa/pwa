/**
 * Cut a CLOSED polyline/strip at a given vertex — the pure part of the R2 step:
 * rotate the point refs so the cut vertex becomes the first point.
 *
 * Per-segment flags need no remap here: they are keyed by start point id
 * (see segmentFlags.js) and every ref keeps its id through the rotation.
 *
 * The vertex ref is NOT duplicated here: the caller performs R1 by appending a
 * fresh db.points row sharing the first point's coordinates, then sets
 * closeLine to false — the segment count stays n.
 *
 * @param {Array<{id: string, type?: string}>} points - annotation.points refs
 * @param {number} vertexIndex - index of the cut vertex (must be a square ref)
 * @returns {{ points: Array }}
 */
export default function cutClosedPolylineAtVertex(points, vertexIndex) {
  const n = points.length;
  const v = ((vertexIndex % n) + n) % n;

  const rotated = [...points.slice(v), ...points.slice(0, v)];

  return { points: rotated };
}
