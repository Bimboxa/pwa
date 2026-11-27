import { PAGE_FRAME_DEFAULTS, resolveFrameInsets } from "./computePageFrame";

export const LEGEND_DEFAULT_WIDTH = 280;
export const LEGEND_DEFAULT_FONT_SIZE = 12;
const PADDING = 16;
// clearance between the legend and the inner line of the page frame
const FRAME_GAP = 12;

// Legend format of a container whose legend was never moved / edited
// (container.legendFormat not persisted yet): top-right corner of the
// container, pushed down / left when needed so it stays inside the inner
// line of the page frame instead of being drawn under it.
// Coordinates are page coordinates (top-left origin, pt).
export default function getDefaultLegendFormat(
  container,
  { pageDims, pageFrame } = {}
) {
  const width = LEGEND_DEFAULT_WIDTH;
  let x = container.x + container.width - width - PADDING;
  let y = container.y + PADDING;

  if (pageFrame && pageDims?.width) {
    const insets = resolveFrameInsets(
      pageFrame.innerInset,
      PAGE_FRAME_DEFAULTS.innerInset
    );
    const halfStroke =
      (pageFrame.innerWidth ?? PAGE_FRAME_DEFAULTS.innerWidth) / 2;
    const clearance = halfStroke + FRAME_GAP;
    const maxX = pageDims.width - insets.right - clearance - width;
    const minX = insets.left + clearance;
    const minY = insets.top + clearance;
    x = Math.max(Math.min(x, maxX), minX);
    y = Math.max(y, minY);
  }

  return {
    x,
    y,
    width,
    fontSize: LEGEND_DEFAULT_FONT_SIZE,
    showQty: true,
  };
}

// Persisted format when there is one, default one otherwise.
export function resolveLegendFormat(container, options) {
  const format =
    container.legendFormat ?? getDefaultLegendFormat(container, options);
  // persisted records may miss fontSize
  if (format.fontSize) return format;
  return { ...format, fontSize: LEGEND_DEFAULT_FONT_SIZE };
}
