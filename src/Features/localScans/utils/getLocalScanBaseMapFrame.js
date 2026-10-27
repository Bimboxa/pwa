import { getBaseMapGroupMatrix } from "./getLocalScanMatrixInBaseMap.js";

const rowsOf = (m, d) =>
  [0, 4, 8, 12].map(
    (offset) => d[0] * m[offset] + d[1] * m[offset + 1] + d[2] * m[offset + 2]
  );

// Projection frame (projectLocalScanSlice) of an EXISTING base map raster:
// u / v = the base map local X / −Y (origin at the image centre, row 0 =
// image top), vertical = world Y (the slice Z), fixed raster = the base map
// reference size and scale. Re-rendering a slice in it keeps every pixel —
// hence every annotation — where it was.
// baseMap: {position, angleDeg, orientation, refWidth, refHeight, meterByPx}
export default function getLocalScanBaseMapFrame(rootMatrixWorld, baseMap) {
  const { refWidth: width, refHeight: height, meterByPx } = baseMap;
  const local = getBaseMapGroupMatrix(baseMap)
    .invert()
    .multiply(rootMatrixWorld).elements;
  const halfU = (width * meterByPx) / 2,
    halfV = (height * meterByPx) / 2;
  return {
    rows: [
      ...rowsOf(local, [1, 0, 0]),
      ...rowsOf(local, [0, -1, 0]),
      ...rowsOf(rootMatrixWorld.elements, [0, 1, 0]),
    ],
    min: [-halfU, -halfV, -Infinity],
    max: [halfU, halfV, Infinity],
    raster: { width, height, pixelSize: meterByPx },
  };
}
