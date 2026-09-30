// The click of a SCENE_3D placement sets the ORIGIN (0, 0) of the scan frame
// — the frame shared by every block of one photogrammetry mission, so two
// scans placed on the same point line up. Returns the two corners (top-left,
// bottom-right) of the scan footprint around that origin, in base map pixels
// (image y grows downward, scan +Y is image up), or null without a footprint.
export default function getScene3dRectanglePointsFromOnePoint({
  annotation,
  baseMapMeterByPx,
  point,
}) {
  const min = annotation?.scene3d?.bbox?.min;
  const max = annotation?.scene3d?.bbox?.max;
  if (!min || !max || !(baseMapMeterByPx > 0)) return null;

  return [
    {
      x: point.x + min[0] / baseMapMeterByPx,
      y: point.y - max[1] / baseMapMeterByPx,
    },
    {
      x: point.x + max[0] / baseMapMeterByPx,
      y: point.y - min[1] / baseMapMeterByPx,
    },
  ];
}
