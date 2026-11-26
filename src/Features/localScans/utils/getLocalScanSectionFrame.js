import { getBaseMapGroupMatrix } from "./getLocalScanMatrixInBaseMap.js";

const rowsOf = (m, d) =>
  [0, 4, 8, 12].map(
    (offset) => d[0] * m[offset] + d[1] * m[offset + 1] + d[2] * m[offset + 2]
  );

// Projection frame (projectLocalScanSlice) of a SECTION page: the raster of
// a posed base map (usually VERTICAL), and — unlike
// getLocalScanBaseMapFrame, whose slice is a world altitude range — a
// "vertical" that is the signed distance to the page plane (its local +Z).
// A slice [-t, +t] is then the slab of the cloud within t of the page:
// what the section plane "prints".
// u / v = the page local X / −Y (origin at the image centre, row 0 = image
// top), fixed raster = the page pixels at its scale.
// page: {position, angleDeg, orientation, width, height (px), meterByPx}
export default function getLocalScanSectionFrame(rootMatrixWorld, page) {
  const { width, height, meterByPx } = page;
  const local = getBaseMapGroupMatrix(page)
    .invert()
    .multiply(rootMatrixWorld).elements;
  const halfU = (width * meterByPx) / 2,
    halfV = (height * meterByPx) / 2;
  return {
    rows: [
      ...rowsOf(local, [1, 0, 0]),
      ...rowsOf(local, [0, -1, 0]),
      ...rowsOf(local, [0, 0, 1]),
    ],
    min: [-halfU, -halfV, -Infinity],
    max: [halfU, halfV, Infinity],
    raster: { width, height, pixelSize: meterByPx },
  };
}
