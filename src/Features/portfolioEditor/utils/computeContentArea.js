import { HEADER_MARGIN, HEADER_HEIGHT } from "./computeHeaderPosition";

const CONTENT_PADDING = 16;

export { CONTENT_PADDING };

export default function computeContentArea(pageDims, footerHeight = 0) {
  const x = HEADER_MARGIN;
  const y = HEADER_MARGIN + HEADER_HEIGHT + CONTENT_PADDING;
  const width = pageDims.width - 2 * HEADER_MARGIN;
  const height = pageDims.height - y - footerHeight - HEADER_MARGIN;

  return { x, y, width, height };
}
