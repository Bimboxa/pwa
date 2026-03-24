import { HEADER_MARGIN, HEADER_HEIGHT } from "./computeHeaderPosition";
import { CONTENT_PADDING } from "./computeContentArea";
import getPageDimensions from "./getPageDimensions";

const TITLE_BAR_HEIGHT = 32;

export { TITLE_BAR_HEIGHT };

export default function getPageLayout(format, orientation, footerHeight = 0) {
  const pageDims = getPageDimensions(format, orientation);
  const isA3Landscape = format === "A3" && orientation === "landscape";

  if (isA3Landscape) {
    // BOTTOM_RIGHT variant: cartouche bottom-right, title bar top-left
    const fullWidth = pageDims.width - 2 * HEADER_MARGIN;
    const cartoucheWidth = Math.round(fullWidth * 0.4);

    const cartouche = {
      x: pageDims.width - HEADER_MARGIN - cartoucheWidth,
      y: pageDims.height - HEADER_MARGIN - HEADER_HEIGHT,
      width: cartoucheWidth,
      height: HEADER_HEIGHT,
    };

    const titleBar = {
      x: HEADER_MARGIN,
      y: HEADER_MARGIN,
      width: fullWidth,
      height: TITLE_BAR_HEIGHT,
    };

    const contentArea = {
      x: HEADER_MARGIN,
      y: HEADER_MARGIN + TITLE_BAR_HEIGHT + CONTENT_PADDING,
      width: fullWidth,
      height:
        pageDims.height -
        HEADER_MARGIN -
        TITLE_BAR_HEIGHT -
        CONTENT_PADDING -
        footerHeight -
        HEADER_MARGIN,
    };

    return { variant: "BOTTOM_RIGHT", cartouche, titleBar, contentArea };
  }

  // TOP_FULL variant: current behavior
  const cartouche = {
    x: HEADER_MARGIN,
    y: HEADER_MARGIN,
    width: pageDims.width - 2 * HEADER_MARGIN,
    height: HEADER_HEIGHT,
  };

  const contentArea = {
    x: HEADER_MARGIN,
    y: HEADER_MARGIN + HEADER_HEIGHT + CONTENT_PADDING,
    width: pageDims.width - 2 * HEADER_MARGIN,
    height:
      pageDims.height -
      HEADER_MARGIN -
      HEADER_HEIGHT -
      CONTENT_PADDING -
      footerHeight -
      HEADER_MARGIN,
  };

  return { variant: "TOP_FULL", cartouche, titleBar: null, contentArea };
}
