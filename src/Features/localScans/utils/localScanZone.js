import { pointInPolygon } from "../../scene3d/utils/clipScene3dChunk.js";
import { getZoneFromPolygon } from "../../scene3d/utils/scene3dZoneTransform.js";

// Zone of interest chosen on the load-time preview, in SOURCE units:
//   {up, polygon: [[h1, h2], …] | null (whole scan), rotationDeg, zMin, zMax,
//    recenter}
// The horizontal frame (h1, h2) is the source seen from above, right-handed:
// up Z → (x, y), up Y → (x, −z). `rotationDeg` is the Scene3dZoneEditor
// preview rotation (θ): the zone's own X axis is R(θ)·(1, 0) in that frame.
// Pure module: runs in the PLY worker and in the node tests.

export function toScanHorizontal(up, x, y, z) {
  return up === "Y" ? [x, -z, y] : [x, y, z];
}

// Projection frame (projectLocalScanSlice) of the whole-scan preview: u = h1,
// v = −h2 so that row 0 is +h2 (image top = +h2, as Scene3dZoneEditor
// expects), w = vertical. `bbox` is the same extent in (h1, h2, vertical).
export function getScanPreviewFrame(bounds, up) {
  const { min, max } = bounds;
  if (up === "Y")
    return {
      rows: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
      min: [min[0], min[2], min[1]],
      max: [max[0], max[2], max[1]],
      bbox: { min: [min[0], -max[2], min[1]], max: [max[0], -min[2], max[1]] },
    };
  return {
    rows: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0],
    min: [min[0], -max[1], min[2]],
    max: [max[0], -min[1], max[2]],
    bbox: { min: [...min], max: [...max] },
  };
}

// → (x, y, z) => boolean, or null when the zone keeps every point.
export function createScanZoneFilter(zone) {
  if (!zone) return null;
  const { up, polygon } = zone;
  const zMin = Number.isFinite(zone.zMin) ? zone.zMin : -Infinity;
  const zMax = Number.isFinite(zone.zMax) ? zone.zMax : Infinity;
  if (!polygon && zMin === -Infinity && zMax === Infinity) return null;
  return (x, y, z) => {
    const [h1, h2, vertical] = toScanHorizontal(up, x, y, z);
    if (vertical < zMin || vertical > zMax) return false;
    return !polygon || pointInPolygon(h1, h2, polygon);
  };
}

const normalizeDeg = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

// Initial placement of a scan loaded through a zone: the zone's X axis
// becomes the displayed X axis (editor axes yaw included) and, with
// `recenter`, the zone centre at zMin becomes scene zero. `wholePolygon`
// (the preview extent) is centred when the zone keeps the whole scan.
export function getScanZonePlacement(zone, axesYawDeg = 0, wholePolygon) {
  const up = zone.up === "Y" ? "Y" : "Z";
  const placement = {
    up,
    yaw: normalizeDeg((axesYawDeg || 0) - (zone.rotationDeg || 0)),
  };
  const polygon = zone.polygon ?? wholePolygon;
  if (!zone.recenter || !polygon) return placement;
  const [c1, c2] = getZoneFromPolygon(polygon, zone.rotationDeg).center;
  const base = Number.isFinite(zone.zMin) ? zone.zMin : 0;
  return {
    ...placement,
    origin: up === "Y" ? [c1, base, -c2] : [c1, c2, base],
  };
}
