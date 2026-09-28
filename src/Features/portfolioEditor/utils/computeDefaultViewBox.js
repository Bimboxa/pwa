// Default framing of a base map container (viewBox in image px): the print
// zone (« Zone d'impression ») when the base map has one, the whole image
// otherwise.
export default function computeDefaultViewBox(baseMap, container) {
  if (!baseMap)
    return { x: 0, y: 0, width: container.width, height: container.height };

  const printZone = baseMap.getPrintZone?.();
  if (printZone) {
    return {
      x: printZone.x,
      y: printZone.y,
      width: printZone.width,
      height: printZone.height,
    };
  }

  const imageSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  if (!imageSize)
    return { x: 0, y: 0, width: container.width, height: container.height };

  return {
    x: 0,
    y: 0,
    width: imageSize.width,
    height: imageSize.height,
  };
}
