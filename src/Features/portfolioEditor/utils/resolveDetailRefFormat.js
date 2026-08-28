import { TITLE_BAR_HEIGHT, getPageMargins } from "./getPageLayout";

// Detail reference element on FOLIO_PAGE pages (page.detailRefFormat),
// shared by the screen renderer (PortfolioDetailRefSvg) and the PDF export
// vector pass. Hidden by default; when shown, the default position is the
// top strip inside margins with right-aligned text, i.e. top-right aligned
// on the page title's default position.

export const DETAIL_REF_FORMAT_DEFAULTS = {
  prefix: "Détail",
  uppercase: false,
  align: "right", // "left" | "center" | "right"
  fontSize: 14,
  color: "#333333",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max < min ? min : max);
}

// -> { show, prefix, uppercase, align, fontSize, color,
//      rect: { x, y, width, height } }
// All geometry in PDF points (SVG top-left coords).
export default function resolveDetailRefFormat(
  page,
  { pageDims, pageFrame = null }
) {
  const format = page?.detailRefFormat;

  const show = format?.show ?? false;
  const fontSize = format?.fontSize || DETAIL_REF_FORMAT_DEFAULTS.fontSize;
  const height = Math.max(TITLE_BAR_HEIGHT, fontSize + 12);

  const m = getPageMargins(pageFrame);
  const seed = {
    x: m.left,
    y: m.top,
    width: pageDims.width - m.left - m.right,
  };

  const width = clamp(format?.width ?? seed.width, 20, pageDims.width);
  const x = clamp(format?.x ?? seed.x, 0, pageDims.width - width);
  const y = clamp(format?.y ?? seed.y, 0, pageDims.height - height);

  return {
    show,
    prefix: format?.prefix ?? DETAIL_REF_FORMAT_DEFAULTS.prefix,
    uppercase: format?.uppercase ?? DETAIL_REF_FORMAT_DEFAULTS.uppercase,
    align: format?.align || DETAIL_REF_FORMAT_DEFAULTS.align,
    fontSize,
    color: format?.color || DETAIL_REF_FORMAT_DEFAULTS.color,
    rect: { x, y, width, height },
  };
}

// Resolved format -> plain object stored in page.detailRefFormat. Always
// persist the fully-resolved shape so partial records never exist.
export function toPersistedDetailRefFormat(resolved, patch = {}) {
  return {
    show: resolved.show,
    prefix: resolved.prefix,
    uppercase: resolved.uppercase,
    align: resolved.align,
    fontSize: resolved.fontSize,
    color: resolved.color,
    x: resolved.rect.x,
    y: resolved.rect.y,
    width: resolved.rect.width,
    ...patch,
  };
}

// "Détail 3" (uppercased on demand); refNumber may be null (prefix alone).
export function getDetailRefText(resolvedFormat, refNumber) {
  const text = [resolvedFormat.prefix, refNumber].filter(Boolean).join(" ");
  return resolvedFormat.uppercase ? text.toUpperCase() : text;
}
