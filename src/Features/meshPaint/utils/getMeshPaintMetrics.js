// Frame metrics of a painted part's base map — node-testable (no imports).
//
// Same source as useAnnotationsV2 (reference image size + meterByPx), NOT
// getBaseMapForRender: its fallbacks (meterByPx 0.01, 1×1 image) would turn a
// base map without scale into fake m² / ml. Missing values → null, and the
// painted part is then listed without quantity.

const isPositive = (v) => Number.isFinite(v) && v > 0;

/**
 * @param {Object} baseMap - BaseMap instance (getImageSize / getMeterByPx) or
 *   a plain record ({image: {imageSize}, meterByPx}).
 * @returns {{imageWidth: number, imageHeight: number, meterByPx: number} | null}
 */
export default function getMeshPaintMetrics(baseMap) {
  if (!baseMap) return null;
  const imageSize =
    (typeof baseMap.getImageSize === "function"
      ? baseMap.getImageSize()
      : null) || baseMap.image?.imageSize;
  const meterByPx =
    typeof baseMap.getMeterByPx === "function"
      ? baseMap.getMeterByPx()
      : baseMap.meterByPx;
  const imageWidth = Number(imageSize?.width);
  const imageHeight = Number(imageSize?.height);
  const mbp = Number(meterByPx);
  if (!isPositive(imageWidth) || !isPositive(imageHeight) || !isPositive(mbp))
    return null;
  return { imageWidth, imageHeight, meterByPx: mbp };
}

/**
 * @param {Array<Object>} baseMaps
 * @returns {Object<string, {imageWidth, imageHeight, meterByPx}>} only the
 *   base maps with complete metrics.
 */
export function getMeshPaintMetricsByBaseMapId(baseMaps) {
  const out = {};
  for (const baseMap of baseMaps ?? []) {
    if (!baseMap?.id) continue;
    const metrics = getMeshPaintMetrics(baseMap);
    if (metrics) out[baseMap.id] = metrics;
  }
  return out;
}
