export default function fitContainerToBaseMap(imageSize, contentArea) {
  const imageAspect = imageSize.width / imageSize.height;
  const areaAspect = contentArea.width / contentArea.height;

  let fitWidth, fitHeight;

  if (imageAspect > areaAspect) {
    fitWidth = contentArea.width;
    fitHeight = contentArea.width / imageAspect;
  } else {
    fitHeight = contentArea.height;
    fitWidth = contentArea.height * imageAspect;
  }

  const x = contentArea.x + (contentArea.width - fitWidth) / 2;
  const y = contentArea.y + (contentArea.height - fitHeight) / 2;

  return { x, y, width: fitWidth, height: fitHeight };
}
