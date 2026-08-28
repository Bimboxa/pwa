import { TITLE_BAR_HEIGHT, getPageMargins } from "./getPageLayout";

// Configurable page title (page.titleFormat), shared by the screen renderer
// (PortfolioTitleBarSvg) and the PDF export vector pass. When titleFormat is
// absent the resolved output reproduces the legacy hardcoded title bar:
// visible only when the layout provides a titleBar slot (A3 landscape),
// 14pt bold #333333 underlined "portfolio · page".

export const TITLE_FORMAT_DEFAULTS = {
  prefixPortfolioName: true,
  suffixPageName: true,
  customText: "",
  color: "#333333",
  fontSize: 14,
  underline: true,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max < min ? min : max);
}

// -> { show, prefixPortfolioName, suffixPageName, customText, color,
//      fontSize, underline, rect: { x, y, width, height } }
// All geometry in PDF points (SVG top-left coords).
export default function resolveTitleFormat(
  page,
  { titleBar = null, pageDims, pageFrame = null }
) {
  const format = page?.titleFormat;

  const show = format?.show ?? Boolean(titleBar);
  const fontSize = format?.fontSize || TITLE_FORMAT_DEFAULTS.fontSize;
  const height = Math.max(TITLE_BAR_HEIGHT, fontSize + 12);

  // position seed: stored value > layout titleBar > top strip inside margins
  const m = getPageMargins(pageFrame);
  const seed = titleBar ?? {
    x: m.left,
    y: m.top,
    width: pageDims.width - m.left - m.right,
  };

  // clamp into the page (handles format / orientation changes and folio dims)
  const width = clamp(format?.width ?? seed.width, 20, pageDims.width);
  const x = clamp(format?.x ?? seed.x, 0, pageDims.width - width);
  const y = clamp(format?.y ?? seed.y, 0, pageDims.height - height);

  return {
    show,
    prefixPortfolioName:
      format?.prefixPortfolioName ?? TITLE_FORMAT_DEFAULTS.prefixPortfolioName,
    suffixPageName:
      format?.suffixPageName ?? TITLE_FORMAT_DEFAULTS.suffixPageName,
    customText: format?.customText ?? TITLE_FORMAT_DEFAULTS.customText,
    color: format?.color || TITLE_FORMAT_DEFAULTS.color,
    fontSize,
    underline: format?.underline ?? TITLE_FORMAT_DEFAULTS.underline,
    rect: { x, y, width, height },
  };
}

// Resolved format -> plain object stored in page.titleFormat. Always persist
// the fully-resolved shape so partial records never exist.
export function toPersistedTitleFormat(resolved, patch = {}) {
  return {
    show: resolved.show,
    prefixPortfolioName: resolved.prefixPortfolioName,
    suffixPageName: resolved.suffixPageName,
    customText: resolved.customText,
    color: resolved.color,
    fontSize: resolved.fontSize,
    underline: resolved.underline,
    x: resolved.rect.x,
    y: resolved.rect.y,
    width: resolved.rect.width,
    ...patch,
  };
}
