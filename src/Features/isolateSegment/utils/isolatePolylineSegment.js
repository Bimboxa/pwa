// « Isoler un segment »: the pieces of a POLYLINE / STRIP once cut at BOTH
// ends of one of its segments. Pure, node-testable.
//
// points: the RAW annotation.points refs ([{id, type?, ...}]); startIndex:
// the index of the segment's start point (segment i = points[i] →
// points[i+1], the closing one being n-1 when closeLine). An S-C-S arc
// (control point `type: "circle"`) is never split through: the segment is
// widened to the whole arc.
//
// Returns null when the polyline is degenerate or the index out of range,
// else:
//   {
//     isolated: { points, indices },   // the segment (arc included)
//     before:   { points, indices } | null,   // open polyline: [0..start]
//     after:    { points, indices } | null,   // open: [end..n-1]; closed: the rest
//     start, end,                      // raw indices of the isolated piece ends
//   }
// A piece with fewer than 2 points does not exist (null). The pieces SHARE
// the cut vertices (same refs). `indices` are the raw positions of each
// piece's points, in piece order — the segment starting at a raw position
// belongs to the piece holding that position anywhere but at its last slot.
export default function isolatePolylineSegment(points, startIndex, closeLine) {
  if (!Array.isArray(points)) return null;
  const n = points.length;
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= n) {
    return null;
  }
  const closed = Boolean(closeLine);
  const segmentCount = closed ? n : n - 1;
  if (segmentCount < 1 || startIndex >= segmentCount) return null;
  if (closed && n < 3) return null;

  const isControl = (i) => points[((i % n) + n) % n]?.type === "circle";

  // Widen to the whole arc (S-C-S): never cut on a control point.
  let start = startIndex;
  let end = startIndex + 1;
  if (isControl(start)) start -= 1;
  if (isControl(end)) end += 1;

  if (!closed) {
    if (start < 0 || end > n - 1) return null;
    const range = (a, b) => {
      const indices = [];
      for (let i = a; i <= b; i++) indices.push(i);
      return { points: indices.map((i) => points[i]), indices };
    };
    const isolated = range(start, end);
    const before = start >= 1 ? range(0, start) : null;
    const after = end <= n - 2 ? range(end, n - 1) : null;
    return { isolated, before, after, start, end };
  }

  // Closed ring: the isolated arc, and the rest walked the other way round
  // from `end` back to `start` — both open, sharing the two cut vertices.
  const wrap = (i) => ((i % n) + n) % n;
  const walk = (from, count) => {
    const indices = [];
    for (let k = 0; k <= count; k++) indices.push(wrap(from + k));
    return { points: indices.map((i) => points[i]), indices };
  };
  const span = end - start; // 1 (plain segment) or 2 (arc)
  if (span >= n) return null;
  const isolated = walk(start, span);
  const restSpan = n - span;
  const after = restSpan >= 1 ? walk(end, restSpan) : null;
  return {
    isolated,
    before: null,
    after,
    start: wrap(start),
    end: wrap(end),
  };
}
