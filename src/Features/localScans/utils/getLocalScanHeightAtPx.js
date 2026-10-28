import sampleScene3dHeightMap from "../../scene3d/utils/sampleScene3dHeightMap.js";

// Height of the point cloud above the plane of its base map (metres) under
// a point of the 2D editor, or null (no point there / outside the image).
// baseMap: {imageSize (reference px), meterByPx}; point: {x, y} in
// reference image px; heightMap: the row built by buildLocalScanHeightMap.
export default function getLocalScanHeightAtPx(
  { imageSize, meterByPx },
  point,
  heightMap
) {
  if (!heightMap || !imageSize || !(meterByPx > 0)) return null;
  const u = (point.x - imageSize.width / 2) * meterByPx;
  const w = (imageSize.height / 2 - point.y) * meterByPx;
  return sampleScene3dHeightMap(heightMap, u, w);
}
