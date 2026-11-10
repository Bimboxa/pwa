import { PX_PER_MM } from "./getBlankBaseMapGeometry.js";

// Scale of a white page (docs/baseMaps/WHITE_PAGE_BASE_MAPS.md): its image is
// a paper sheet rasterized at PX_PER_MM, so its resolution and its 1:N scale
// are one and the same value.
//
// Pure: node-testable.

// 1:N scale of a white page from its resolution (null without a scale).
export function getWhitePageScale(meterByPx) {
  if (!(meterByPx > 0)) return null;
  return Math.round(meterByPx * PX_PER_MM * 1000 * 100) / 100;
}

// Resolution of a white page drawn at 1:scale.
export function getWhitePageMeterByPx(scale) {
  if (!(scale > 0)) return null;
  return scale / (PX_PER_MM * 1000);
}

// Paper size (mm) of a white page from its image size.
export function getWhitePagePaperSizeMm(imageSize) {
  if (!(imageSize?.width > 0) || !(imageSize?.height > 0)) return null;
  return {
    width: imageSize.width / PX_PER_MM,
    height: imageSize.height / PX_PER_MM,
  };
}
