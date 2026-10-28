import { getBaseMapGroupMatrix } from "./getLocalScanMatrixInBaseMap.js";

const rowsOf = (m, d) =>
  [0, 4, 8, 12].map(
    (offset) => d[0] * m[offset] + d[1] * m[offset + 1] + d[2] * m[offset + 2]
  );

// Frame of the height map of a scan base map (rasterizeLocalScanHeightMap),
// in the BASE MAP GROUP frame so the map survives every later move of the
// map (the point cloud is glued to it): u = local X (image X), w = local Y
// (image up), h = local Z (the plane normal — world up for a horizontal
// base map). The horizontal extent is the reference raster; the height
// extent comes from the scan bounds.
// baseMap: {position, angleDeg, orientation, refWidth, refHeight, meterByPx}
export default function getLocalScanHeightFrame(
  rootMatrixWorld,
  baseMap,
  bounds
) {
  const { refWidth: width, refHeight: height, meterByPx } = baseMap;
  const local = getBaseMapGroupMatrix(baseMap)
    .invert()
    .multiply(rootMatrixWorld).elements;
  const rows = [
    ...rowsOf(local, [1, 0, 0]),
    ...rowsOf(local, [0, 1, 0]),
    ...rowsOf(local, [0, 0, 1]),
  ];
  let hMin = Infinity,
    hMax = -Infinity;
  for (let corner = 0; corner < 8; corner++) {
    const p = [0, 1, 2].map(
      (axis) => bounds[(corner >> axis) & 1 ? "max" : "min"][axis]
    );
    const h = rows[8] * p[0] + rows[9] * p[1] + rows[10] * p[2] + rows[11];
    hMin = Math.min(hMin, h);
    hMax = Math.max(hMax, h);
  }
  const halfU = (width * meterByPx) / 2,
    halfW = (height * meterByPx) / 2;
  return {
    rows,
    min: [-halfU, -halfW, hMin],
    max: [halfU, halfW, hMax],
  };
}
