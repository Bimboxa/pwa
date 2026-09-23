// Footprint of an IMAGE annotation on a base map, in base-map image px.
// Scaled placement: image px × (image m/px) / (base map m/px). Without one of
// the two scales the image is placed at a readable default: its own pixel
// size, capped to a quarter of the base map width, aspect ratio kept.
const DEFAULT_WIDTH_RATIO = 0.25;

export default function getImageAnnotationSizeInBaseMapPx({
  image,
  meterByPx,
  baseMapMeterByPx,
  baseMapImageSize,
}) {
  const imgW = image?.imageSize?.width;
  const imgH = image?.imageSize?.height;
  if (!(imgW > 0) || !(imgH > 0)) return null;

  const hasScales = meterByPx > 0 && baseMapMeterByPx > 0;
  if (hasScales) {
    return {
      width: (imgW * meterByPx) / baseMapMeterByPx,
      height: (imgH * meterByPx) / baseMapMeterByPx,
    };
  }

  const bgW = baseMapImageSize?.width;
  const width = bgW > 0 ? Math.min(imgW, bgW * DEFAULT_WIDTH_RATIO) : imgW;
  return { width, height: (width * imgH) / imgW };
}
