// Geometry of the continuous PDF viewer (ViewerPdfPagesScroll): the pages
// are stacked vertically in ONE scroll area, `gap` px apart, `padding` px
// from the edges. Everything here is pure (px in the scroll content frame).

// sizes: [{width, height}] of the pages at scale 1 (displayed rotation).
export function getPdfPagesScrollLayout({
  sizes,
  scale,
  gap = 0,
  padding = 0,
}) {
  const offsets = [];
  const widths = [];
  const heights = [];
  let top = padding;
  let maxWidth = 0;

  for (const size of sizes ?? []) {
    const width = size.width * scale;
    const height = size.height * scale;
    offsets.push(top);
    widths.push(width);
    heights.push(height);
    maxWidth = Math.max(maxWidth, width);
    top += height + gap;
  }

  const count = offsets.length;
  const totalHeight = count > 0 ? top - gap + padding : 0;

  return {
    scale,
    offsets,
    widths,
    heights,
    totalHeight,
    contentWidth: maxWidth + 2 * padding,
  };
}

// Index of the page holding `y` (the closest one when `y` falls in a gap or
// outside the stack). -1 without pages.
export function getPdfPageIndexAtY({ offsets, heights }, y) {
  const count = offsets.length;
  if (count === 0) return -1;
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= y) low = mid;
    else high = mid - 1;
  }
  // in the gap under page `low`: closer to the next page?
  const bottom = offsets[low] + heights[low];
  if (y > bottom && low < count - 1 && offsets[low + 1] - y < y - bottom) {
    return low + 1;
  }
  return low;
}

// Pages to mount: those crossing the viewport, plus `overscan` px above and
// below (pre-rendered so scrolling does not reveal blank sheets).
export function getPdfPagesVisibleRange(
  layout,
  { scrollTop, viewportHeight, overscan = 0 }
) {
  const count = layout.offsets.length;
  if (count === 0) return { first: 0, last: -1 };

  const top = scrollTop - overscan;
  const bottom = scrollTop + viewportHeight + overscan;

  let first = getPdfPageIndexAtY(layout, top);
  while (
    first > 0 &&
    layout.offsets[first - 1] + layout.heights[first - 1] > top
  )
    first -= 1;
  let last = first;
  while (last < count - 1 && layout.offsets[last + 1] < bottom) last += 1;

  return { first, last };
}

function getVisibleHeight(layout, index, scrollTop, viewportHeight) {
  const top = Math.max(layout.offsets[index], scrollTop);
  const bottom = Math.min(
    layout.offsets[index] + layout.heights[index],
    scrollTop + viewportHeight
  );
  return Math.max(0, bottom - top);
}

// "Current" page = the one showing the most in the viewport. The page that
// is already current keeps the title while it shows as much as the best one
// (two whole pages on screen, end of the document that cannot scroll
// further): a page the user just jumped to is not taken away from them.
export function getPdfMostVisiblePageIndex(
  layout,
  { scrollTop, viewportHeight, currentIndex = -1 }
) {
  const count = layout.offsets.length;
  if (count === 0) return -1;

  const { first, last } = getPdfPagesVisibleRange(layout, {
    scrollTop,
    viewportHeight,
  });

  let best = first;
  let bestHeight = -1;
  for (let i = first; i <= last; i++) {
    const visible = getVisibleHeight(layout, i, scrollTop, viewportHeight);
    if (visible > bestHeight + 0.5) {
      best = i;
      bestHeight = visible;
    }
  }

  if (currentIndex >= 0 && currentIndex < count) {
    const current = getVisibleHeight(
      layout,
      currentIndex,
      scrollTop,
      viewportHeight
    );
    if (current >= bestHeight - 0.5) return currentIndex;
  }
  return best;
}

// Anchor = the document point under a viewport point (`viewportX/Y`, px from
// the scroll area's top-left), expressed independently of the scale: page
// index + fraction of its height, and the horizontal distance to the pages'
// axis in page units. Used to keep that point still when the layout changes
// (zoom, rotation, resize).
export function getPdfScrollAnchor(
  layout,
  { scrollTop, scrollLeft, viewportWidth, viewportX, viewportY }
) {
  const y = scrollTop + viewportY;
  const index = getPdfPageIndexAtY(layout, y);
  if (index < 0) return null;
  const axisX = Math.max(viewportWidth, layout.contentWidth) / 2;
  return {
    index,
    fractionY: (y - layout.offsets[index]) / (layout.heights[index] || 1),
    unitsX: (scrollLeft + viewportX - axisX) / layout.scale,
    viewportX,
    viewportY,
  };
}

// Scroll position putting `anchor` back under its viewport point in `layout`.
export function getPdfScrollForAnchor(layout, anchor, { viewportWidth }) {
  const count = layout.offsets.length;
  if (!anchor || count === 0) return null;
  const index = Math.min(anchor.index, count - 1);
  const axisX = Math.max(viewportWidth, layout.contentWidth) / 2;
  return {
    scrollTop:
      layout.offsets[index] +
      anchor.fractionY * layout.heights[index] -
      anchor.viewportY,
    scrollLeft: axisX + anchor.unitsX * layout.scale - anchor.viewportX,
  };
}
