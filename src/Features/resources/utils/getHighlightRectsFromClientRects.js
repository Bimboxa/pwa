// Converts the DOM client rects of a text selection into highlight rects
// normalized [0..1] against the displayed page box (`containerRect`, top-left
// origin). The browser returns one rect per text span (often duplicated or
// overlapping): rects of the same line are merged into one band.

const MIN_SIZE_PX = 1;

export default function getHighlightRectsFromClientRects({
  clientRects,
  containerRect,
}) {
  const cw = containerRect?.width;
  const ch = containerRect?.height;
  if (!cw || !ch) return [];

  // clip to the page + drop empty rects
  const rects = [];
  for (const r of clientRects ?? []) {
    const left = Math.max(r.left, containerRect.left);
    const top = Math.max(r.top, containerRect.top);
    const right = Math.min(r.right, containerRect.left + cw);
    const bottom = Math.min(r.bottom, containerRect.top + ch);
    if (right - left < MIN_SIZE_PX || bottom - top < MIN_SIZE_PX) continue;
    rects.push({ left, top, right, bottom });
  }
  if (rects.length === 0) return [];

  rects.sort((a, b) => a.top - b.top || a.left - b.left);

  // Same line = vertical centers closer than half the smaller height.
  const lines = [];
  for (const r of rects) {
    const center = (r.top + r.bottom) / 2;
    const height = r.bottom - r.top;
    const line = lines.find((l) => {
      const lCenter = (l.top + l.bottom) / 2;
      const lHeight = l.bottom - l.top;
      return Math.abs(center - lCenter) < Math.min(height, lHeight) / 2;
    });
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    } else {
      lines.push({ ...r });
    }
  }

  return lines.map((l) => ({
    x: (l.left - containerRect.left) / cw,
    y: (l.top - containerRect.top) / ch,
    width: (l.right - l.left) / cw,
    height: (l.bottom - l.top) / ch,
  }));
}
