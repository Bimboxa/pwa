import sampleScene3dHeightMap from "./sampleScene3dHeightMap.js";
import { baseMapPxToScan, scanToZoneLocal } from "./scene3dZoneTransform.js";

// Height of the scan surface above the plane of its base map (metres) under
// a point of the 2D editor, or null (outside the zone / no surface there).
//
// baseMap: {scene3d, imageSize (reference px), meterByPx} — the plane of the
// base map sits at `scene3d.zone.zMin` (lowest point of the clipped scan).
// point: {x, y} in reference image px.
export default function getScene3dHeightAtPx(baseMap, point, heightMap) {
  if (!heightMap) return null;
  const scanPoint = getScene3dScanPointFromPx(baseMap, point);
  if (!scanPoint) return null;
  const z = sampleScene3dHeightMap(heightMap, scanPoint[0], scanPoint[1]);
  if (z === null) return null;
  return z - (baseMap.scene3d.zone.zMin ?? baseMap.scene3d.bbox.min[2]);
}

// Point of the 2D editor → point of the scan frame ([x, y], metres), or
// null when outside the zone rectangle of the base map.
export function getScene3dScanPointFromPx(baseMap, point) {
  const scanPoint = baseMapPxToScan(baseMap, point);
  if (!scanPoint) return null;
  const zone = baseMap.scene3d.zone;
  const [qx, qy] = scanToZoneLocal(zone, scanPoint);
  if (Math.abs(qx) > zone.width / 2 || Math.abs(qy) > zone.height / 2) {
    return null;
  }
  return scanPoint;
}
