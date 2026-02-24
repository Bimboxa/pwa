const HEADER_WIDTH = 350;
const HEADER_HEIGHT = 80;
const HEADER_MARGIN = 20;

export { HEADER_WIDTH, HEADER_HEIGHT, HEADER_MARGIN };

export default function computeHeaderPosition(
  pageDims,
  position = "bottom-right"
) {
  const w = HEADER_WIDTH;
  const h = HEADER_HEIGHT;
  const m = HEADER_MARGIN;

  switch (position) {
    case "top-right":
      return { x: pageDims.width - w - m, y: m, width: w, height: h };
    case "top-left":
      return { x: m, y: m, width: w, height: h };
    case "bottom-left":
      return { x: m, y: pageDims.height - h - m, width: w, height: h };
    case "bottom-right":
    default:
      return {
        x: pageDims.width - w - m,
        y: pageDims.height - h - m,
        width: w,
        height: h,
      };
  }
}
