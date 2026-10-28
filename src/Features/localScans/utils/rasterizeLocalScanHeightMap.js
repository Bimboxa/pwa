import {
  createHeightMapRaster,
  HEIGHT_MAP_QUANT_MAX,
} from "../../scene3d/utils/rasterizeScene3dHeightMap.js";

// Height map of a scan base map projected from a point cloud: the same
// top-down Uint16 grid as the « Scène 3D » meshes (rasterizeScene3dHeightMap,
// read by sampleScene3dHeightMap), holding per cell the HIGHEST point seen
// from above. Built in the frame of the base map (getLocalScanHeightFrame):
// u = image X, w = image up, h = height above the base map plane.
// frame: {rows (12: u, w, h of a source point), min: [u, w, h], max}.
// Pure module: runs in the projection worker and in the node tests.
export default function rasterizeLocalScanHeightMap(
  positions,
  { rows: r, min, max, maxCells }
) {
  const raster = createHeightMapRaster({
    bbox: { min, max },
    ...(maxCells && { maxCells }),
  });
  const { cols, rows, cellSize, data } = raster;
  const extentH = Math.max(max[2] - min[2], 1e-6);
  const quant = HEIGHT_MAP_QUANT_MAX / extentH;
  const count = Math.floor(positions.length / 3);
  for (let i = 0; i < count; i++) {
    const k = i * 3,
      x = positions[k],
      y = positions[k + 1],
      z = positions[k + 2];
    const u = r[0] * x + r[1] * y + r[2] * z + r[3];
    const w = r[4] * x + r[5] * y + r[6] * z + r[7];
    const col = Math.floor((u - min[0]) / cellSize);
    const row = Math.floor((max[1] - w) / cellSize);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    const h = r[8] * x + r[9] * y + r[10] * z + r[11];
    const value = Math.min(
      HEIGHT_MAP_QUANT_MAX,
      Math.max(1, Math.round((h - min[2]) * quant))
    );
    const index = row * cols + col;
    if (value > data[index]) data[index] = value;
  }
  return raster;
}
