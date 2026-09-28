import { HEADER_MARGIN, HEADER_HEIGHT } from "./computeHeaderPosition";
import { CONTENT_PADDING } from "./computeContentArea";
import getPageDimensions from "./getPageDimensions";
import { resolveFrameInsets, PAGE_FRAME_DEFAULTS } from "./computePageFrame";

const TITLE_BAR_HEIGHT = 32;
// Bottom-right cartouche: 40% of the inner width, capped so the title block
// keeps its A3 size on A2 / A1 / A0 sheets (449 pt = A3 landscape value).
const MAX_CARTOUCHE_WIDTH_PT = 449;

export { TITLE_BAR_HEIGHT };

// Page margins: the double page frame's inner (thick) line is also the page
// margin, so the cartouche / title bar / content area are glued to it.
// innerInset may be per-side ({ top, right, bottom, left }) to match a source
// frame with non-uniform insets.
export function getPageMargins(pageFrame) {
  if (!pageFrame) return resolveFrameInsets(null, HEADER_MARGIN);
  return resolveFrameInsets(
    pageFrame.innerInset,
    PAGE_FRAME_DEFAULTS.innerInset
  );
}

// Bottom-right cartouche rect for a page of arbitrary dimensions (PDF points,
// SVG top-left coords). Shared by the A3 landscape layout and folio pages
// (screen + PDF export). Returns null when the page is too small.
export function getCartoucheRectBottomRight(
  pageDims,
  titleBlockHeight,
  pageFrame = null
) {
  const m = getPageMargins(pageFrame);
  const fullWidth = pageDims.width - m.left - m.right;
  const cartoucheWidth = Math.min(
    Math.round(fullWidth * 0.4),
    MAX_CARTOUCHE_WIDTH_PT
  );
  if (
    cartoucheWidth < 200 ||
    pageDims.height < titleBlockHeight + m.top + m.bottom
  )
    return null;
  return {
    x: pageDims.width - m.right - cartoucheWidth,
    y: pageDims.height - m.bottom - titleBlockHeight,
    width: cartoucheWidth,
    height: titleBlockHeight,
  };
}

export default function getPageLayout(
  format,
  orientation,
  footerHeight = 0,
  titleBlockHeight = HEADER_HEIGHT, // from the title block manifest
  pageFrame = null
) {
  const pageDims = getPageDimensions(format, orientation);
  // A3 and larger landscape sheets: plan-style layout (cartouche bottom
  // right); A4 (and every portrait page) keeps the full-width top cartouche.
  const isLargeLandscape = orientation === "landscape" && format !== "A4";
  const m = getPageMargins(pageFrame);
  const fullWidth = pageDims.width - m.left - m.right;

  if (isLargeLandscape) {
    // BOTTOM_RIGHT variant: cartouche bottom-right, title bar top-left
    const cartouche = getCartoucheRectBottomRight(
      pageDims,
      titleBlockHeight,
      pageFrame
    );

    const titleBar = {
      x: m.left,
      y: m.top,
      width: fullWidth,
      height: TITLE_BAR_HEIGHT,
    };

    const contentArea = {
      x: m.left,
      y: m.top + TITLE_BAR_HEIGHT + CONTENT_PADDING,
      width: fullWidth,
      height:
        pageDims.height -
        m.top -
        TITLE_BAR_HEIGHT -
        CONTENT_PADDING -
        footerHeight -
        m.bottom,
    };

    return { variant: "BOTTOM_RIGHT", cartouche, titleBar, contentArea };
  }

  // TOP_FULL variant: cartouche full-width at the top
  const cartouche = {
    x: m.left,
    y: m.top,
    width: fullWidth,
    height: titleBlockHeight,
  };

  const contentArea = {
    x: m.left,
    y: m.top + titleBlockHeight + CONTENT_PADDING,
    width: fullWidth,
    height:
      pageDims.height -
      m.top -
      titleBlockHeight -
      CONTENT_PADDING -
      footerHeight -
      m.bottom,
  };

  return { variant: "TOP_FULL", cartouche, titleBar: null, contentArea };
}
