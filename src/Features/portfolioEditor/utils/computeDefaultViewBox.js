export default function computeDefaultViewBox(baseMap, container) {
  if (!baseMap) return { x: 0, y: 0, width: container.width, height: container.height };

  const imageSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  if (!imageSize) return { x: 0, y: 0, width: container.width, height: container.height };

  return {
    x: 0,
    y: 0,
    width: imageSize.width,
    height: imageSize.height,
  };
}
