// Compute the two corner points (top-left, bottom-right) of an OBJECT_3D
// annotation centered on the click point. Footprint is the model's X×Z extent
// in meters, converted to basemap pixels via baseMapMeterByPx.

const FALLBACK_FOOTPRINT_M = 0.5;

export default function getObject3DAnnotationRectanglePointsFromOnePoint({
  annotation,
  baseMapMeterByPx,
  point,
}) {
  const modelBbox = annotation?.object3D?.bbox;
  const widthM = modelBbox?.width ?? FALLBACK_FOOTPRINT_M;
  const depthM = modelBbox?.depth ?? FALLBACK_FOOTPRINT_M;

  const widthPx = widthM / baseMapMeterByPx;
  const heightPx = depthM / baseMapMeterByPx;

  const x1 = point.x - widthPx / 2;
  const y1 = point.y - heightPx / 2;
  const x2 = point.x + widthPx / 2;
  const y2 = point.y + heightPx / 2;

  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];
}
