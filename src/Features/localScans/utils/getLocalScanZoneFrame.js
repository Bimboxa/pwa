import getLocalScanSliceFrame from "./getLocalScanSliceFrame.js";
import {
  getZoneFromPolygon,
  zoneLocalToScan,
} from "../../scene3d/utils/scene3dZoneTransform.js";

// Projection frame (projectLocalScanSlice) of the base map created from a
// load zone: the horizontal extent is the zone RECTANGLE (the zone frame of
// Scene3dZoneEditor, axis-aligned once the scan is placed with
// getScanZonePlacement), not the bounding box of the decoded points — so a
// rotated zone gives an image without white corners. The vertical extent
// and the rows come from getLocalScanSliceFrame.
// zone: {up, polygon | null, rotationDeg} (localScanZone.js); wholePolygon:
// the preview extent, used when the zone keeps the whole scan.
export default function getLocalScanZoneFrame(
  zone,
  wholePolygon,
  bounds,
  m,
  axesYawDeg = 0
) {
  const base = getLocalScanSliceFrame(bounds, m, axesYawDeg);
  const polygon = zone?.polygon ?? wholePolygon;
  if (!polygon) return base;
  const rotationDeg = zone?.rotationDeg || 0;
  const rect = getZoneFromPolygon(polygon, rotationDeg);
  const r = base.rows;
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const [h1, h2] = zoneLocalToScan({ center: rect.center, rotationDeg }, [
      (sx * rect.width) / 2,
      (sy * rect.height) / 2,
    ]);
    // The horizontal rows do not depend on the source vertical coordinate
    // (toScanHorizontal inverse: up Y → z = −h2).
    const p = zone?.up === "Y" ? [h1, 0, -h2] : [h1, h2, 0];
    for (let axis = 0; axis < 2; axis++) {
      const o = axis * 4;
      const value = r[o] * p[0] + r[o + 1] * p[1] + r[o + 2] * p[2] + r[o + 3];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return {
    ...base,
    min: [min[0], min[1], base.min[2]],
    max: [max[0], max[1], base.max[2]],
  };
}
