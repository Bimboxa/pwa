import getImageAnnotationSizeInBaseMapPx from "./getImageAnnotationSizeInBaseMapPx";

// One-click IMAGE placement: the click is the CENTRE of the image; the two
// returned corners feed the `drawRectangle` bbox commit.
export default function getImageAnnotationRectanglePointsFromOnePoint({
  annotation,
  baseMapMeterByPx,
  baseMapImageSize,
  point,
}) {
  const size = getImageAnnotationSizeInBaseMapPx({
    image: annotation?.image,
    meterByPx: annotation?.meterByPx,
    baseMapMeterByPx,
    baseMapImageSize,
  });
  if (!size) return null;

  const { width, height } = size;
  return [
    { x: point.x - width / 2, y: point.y - height / 2 },
    { x: point.x + width / 2, y: point.y + height / 2 },
  ];
}
