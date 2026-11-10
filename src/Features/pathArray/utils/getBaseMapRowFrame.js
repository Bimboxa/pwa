import getBaseMapRenderScale from "Features/baseMaps/js/getBaseMapRenderScale";

// Reference frame of a db.baseMaps ROW, as the BaseMap class resolves it
// (getImageSize / render scale): the size the normalized coordinates refer to
// and the scale in meters per pixel. Null when the row has no usable frame.
export default function getBaseMapRowFrame(baseMap) {
  if (!baseMap) return null;
  const imageSize =
    baseMap.versions?.length > 0 && baseMap.refWidth && baseMap.refHeight
      ? { width: baseMap.refWidth, height: baseMap.refHeight }
      : baseMap.image?.imageSize;
  const meterByPx = getBaseMapRenderScale(baseMap);
  if (!imageSize?.width || !imageSize?.height || !(meterByPx > 0)) return null;
  return { imageSize, meterByPx };
}
