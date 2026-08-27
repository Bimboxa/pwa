import { HEADER_MARGIN, HEADER_HEIGHT } from "./computeHeaderPosition";
import { CONTENT_PADDING } from "./computeContentArea";
import getPageDimensions from "./getPageDimensions";

const TITLE_BAR_HEIGHT = 32;

export { TITLE_BAR_HEIGHT };

// Bottom-right cartouche rect for a page of arbitrary dimensions (PDF points,
// SVG top-left coords). Shared by the A3 landscape layout and folio pages
// (screen + PDF export). Returns null when the page is too small.
export function getCartoucheRectBottomRight(pageDims, titleBlockHeight) {
  const fullWidth = pageDims.width - 2 * HEADER_MARGIN;
  const cartoucheWidth = Math.round(fullWidth * 0.4);
  if (
    cartoucheWidth < 200 ||
    pageDims.height < titleBlockHeight + 2 * HEADER_MARGIN
  )
    return null;
  return {
    x: pageDims.width - HEADER_MARGIN - cartoucheWidth,
    y: pageDims.height - HEADER_MARGIN - titleBlockHeight,
    width: cartoucheWidth,
    height: titleBlockHeight,
  };
}

export default function getPageLayout(
  format,
  orientation,
  footerHeight = 0,
  titleBlockHeight = HEADER_HEIGHT // from the title block manifest
) {
  const pageDims = getPageDimensions(format, orientation);
  const isA3Landscape = format === "A3" && orientation === "landscape";

  if (isA3Landscape) {
    // BOTTOM_RIGHT variant: cartouche bottom-right, title bar top-left
    const fullWidth = pageDims.width - 2 * HEADER_MARGIN;

    const cartouche = getCartoucheRectBottomRight(pageDims, titleBlockHeight);

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
    height: titleBlockHeight,
  };

  const contentArea = {
    x: HEADER_MARGIN,
    y: HEADER_MARGIN + titleBlockHeight + CONTENT_PADDING,
    width: pageDims.width - 2 * HEADER_MARGIN,
    height:
      pageDims.height -
      HEADER_MARGIN -
      titleBlockHeight -
      CONTENT_PADDING -
      footerHeight -
      HEADER_MARGIN,
  };

  return { variant: "TOP_FULL", cartouche, titleBar: null, contentArea };
}
