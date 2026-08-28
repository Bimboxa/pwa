// Pure geometry for the double page border frame (thin outer line + thick
// inner line, technical-drawing style). Config comes from
// appConfig features.portfolios.pageFrame; returns null when disabled.
// Rects are stroke centerlines, in SVG coordinates (top-left origin, pt).
// The cartouche and content area are glued to the inner line: the frame's
// innerInset is also the page margin used by getPageLayout.
//
// outerInset / innerInset accept a number (uniform) or per-side values
// { top, right, bottom, left } (matching a source frame whose insets are not
// uniform, e.g. the Etandex INS Plan frame).

export const PAGE_FRAME_DEFAULTS = {
  outerInset: 20,
  outerWidth: 0.75,
  innerInset: 34,
  innerWidth: 2,
  color: "#333",
};

export function resolveFrameInsets(value, fallback) {
  if (value == null) value = fallback;
  if (typeof value === "number")
    return { top: value, right: value, bottom: value, left: value };
  return {
    top: value.top ?? fallback,
    right: value.right ?? fallback,
    bottom: value.bottom ?? fallback,
    left: value.left ?? fallback,
  };
}

function insetRect(pageDims, insets, strokeWidth) {
  return {
    x: insets.left,
    y: insets.top,
    width: pageDims.width - insets.left - insets.right,
    height: pageDims.height - insets.top - insets.bottom,
    strokeWidth,
  };
}

export default function computePageFrame(pageDims, frameConfig) {
  if (!frameConfig || !pageDims?.width || !pageDims?.height) return null;

  const outerInsets = resolveFrameInsets(
    frameConfig.outerInset,
    PAGE_FRAME_DEFAULTS.outerInset
  );
  const innerInsets = resolveFrameInsets(
    frameConfig.innerInset,
    PAGE_FRAME_DEFAULTS.innerInset
  );

  return {
    outer: insetRect(
      pageDims,
      outerInsets,
      frameConfig.outerWidth ?? PAGE_FRAME_DEFAULTS.outerWidth
    ),
    inner: insetRect(
      pageDims,
      innerInsets,
      frameConfig.innerWidth ?? PAGE_FRAME_DEFAULTS.innerWidth
    ),
    color: frameConfig.color ?? PAGE_FRAME_DEFAULTS.color,
  };
}
