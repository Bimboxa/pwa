import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";

/**
 * After applyOpeningOnPolygon carved a notch into a host polygon, EVERY ring
 * point gets a new db id — the opening's stored anchor ids no longer exist in
 * the host contour. This re-derives the anchor geometrically on the carved
 * ring:
 *   - startId / endId: ring points sitting exactly at the original hosting
 *     segment endpoints (the carve preserves their coordinates),
 *   - notchPointIds: ring points lying on the opening band boundary (the
 *     notch corners inserted by the carve).
 *
 * @param {Object} args
 * @param {Array<{id: string}>} args.ringRefs - carved outer ring point refs
 * @param {Record<string, {x,y}>} args.pxById - px position of each ring point
 * @param {{x,y}} args.segStartPx - original hosting segment start (reference vertex)
 * @param {{x,y}} args.segEndPx - original hosting segment end
 * @param {Array<{x,y}>} args.bandPx - opening band polygon (px)
 * @param {number} [args.epsilon]
 * @returns {{ startId: string|null, endId: string|null, notchPointIds: string[] }}
 */
export default function deriveOpeningContourAnchor({
  ringRefs,
  pxById,
  segStartPx,
  segEndPx,
  bandPx,
  epsilon = 1.5,
}) {
  let startId = null;
  let endId = null;
  const notchPointIds = [];

  const distToBand = (p) => {
    if (!Array.isArray(bandPx) || bandPx.length < 3) return Infinity;
    let min = Infinity;
    for (let i = 0; i < bandPx.length; i++) {
      const a = bandPx[i];
      const b = bandPx[(i + 1) % bandPx.length];
      const { distance } = projectPointOnSegment(p, a, b);
      if (distance < min) min = distance;
    }
    return min;
  };

  for (const ref of ringRefs ?? []) {
    const px = pxById?.[ref?.id];
    if (!px) continue;
    if (
      segStartPx &&
      Math.hypot(px.x - segStartPx.x, px.y - segStartPx.y) <= epsilon
    ) {
      startId = ref.id;
      continue;
    }
    if (
      segEndPx &&
      Math.hypot(px.x - segEndPx.x, px.y - segEndPx.y) <= epsilon
    ) {
      endId = ref.id;
      continue;
    }
    if (distToBand(px) <= epsilon) {
      notchPointIds.push(ref.id);
    }
  }

  return { startId, endId, notchPointIds };
}
