// Visible part of a CUT_LINE polyline once its stop points are applied.
//
// points: the polyline in drawing order, [{..., derived?, stop?}]. The
// `derived` points are the ones added by the extension of the line, and only
// sit at the head and at the tail of the array; the drawn points are in
// between.
//
// A stop point in the extended HEAD (before the first drawn point) truncates
// the start: the line is kept from that point (included) to the end. Any
// other stop point (drawn, or in the extended tail) truncates the end: the
// line is kept from the start to that point (included). With several stops
// on one side, the one closest to the drawn points wins.
//
// Returns { points, startIndex, endIndex } — indices into the input array,
// inclusive. An empty input gives { points: [], startIndex: -1, endIndex: -1 }.
export default function getCutLineVisiblePoints(points) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return { points: [], startIndex: -1, endIndex: -1 };

  const firstDrawnIndex = list.findIndex((p) => !p?.derived);
  // All points derived: the whole line counts as drawn (no head to truncate).
  const headEnd = firstDrawnIndex < 0 ? 0 : firstDrawnIndex;

  let startIndex = 0;
  let endIndex = list.length - 1;
  for (let i = 0; i < list.length; i++) {
    if (!list[i]?.stop) continue;
    if (i < headEnd) {
      // Head stop: the closest to the drawn points is the last one.
      startIndex = Math.max(startIndex, i);
    } else {
      // Tail (or drawn) stop: the closest to the drawn points is the first.
      endIndex = Math.min(endIndex, i);
    }
  }

  return {
    points: list.slice(startIndex, endIndex + 1),
    startIndex,
    endIndex,
  };
}
