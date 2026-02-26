const HEADER_MARGIN = 16;
const HEADER_HEIGHT = 84;
const ROW_HEIGHT = 28;
const LOGO_COL_WIDTH = 126;

export { HEADER_MARGIN, HEADER_HEIGHT, ROW_HEIGHT, LOGO_COL_WIDTH };

export default function computeHeaderPosition(pageDims) {
  return {
    x: HEADER_MARGIN,
    y: HEADER_MARGIN,
    width: pageDims.width - 2 * HEADER_MARGIN,
    height: HEADER_HEIGHT,
  };
}
