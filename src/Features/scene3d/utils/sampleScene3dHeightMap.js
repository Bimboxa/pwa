import { HEIGHT_MAP_QUANT_MAX } from "./rasterizeScene3dHeightMap.js";

// Height of the scan surface at a point of the scan frame (metres, XY),
// read from its height map (see rasterizeScene3dHeightMap): the Z (metres,
// scan frame) of the highest surface in that cell, or null when the point
// is outside the grid or the cell holds no surface.
export default function sampleScene3dHeightMap(heightMap, sx, sy) {
  if (!heightMap?.data) return null;
  const { cols, rows, cellSize, bbox, data } = heightMap;
  const col = Math.floor((sx - bbox.min[0]) / cellSize);
  const row = Math.floor((bbox.max[1] - sy) / cellSize);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  const value = data[row * cols + col];
  if (value === 0) return null;
  const extentZ = bbox.max[2] - bbox.min[2];
  return bbox.min[2] + (value / HEIGHT_MAP_QUANT_MAX) * extentZ;
}
