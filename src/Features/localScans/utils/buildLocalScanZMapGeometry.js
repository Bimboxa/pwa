import { HEIGHT_MAP_QUANT_MAX } from "../../scene3d/utils/rasterizeScene3dHeightMap.js";

// Zmap: the height map of a scan base map (rasterizeLocalScanHeightMap,
// base map group frame: u = image X, w = image up, h = above the plane) as
// a mesh the 3D raycaster can hit (altimetry under the cursor, drawing on
// the relief). The grid is downsampled to `maxSize` cells per side (block
// maximum, the highest point wins like in the map); a quad is built only
// where its four corners hold a surface, so real holes stay open.
// colorAt(t) → [r, g, b] in 0..1, t = height position in `range` ([hMin,
// hMax] above the plane; the whole extent when absent).
// → {positions: Float32Array (x = u, y = w, z = h), colors: Float32Array,
//    index: Uint32Array, vertexCount, triangleCount}
// Pure module (node tests).
export default function buildLocalScanZMapGeometry(
  heightMap,
  { maxSize = 512, range, colorAt } = {}
) {
  const { cols, rows, cellSize, bbox, data } = heightMap;
  const block = Math.max(1, Math.ceil(Math.max(cols, rows) / maxSize));
  const gridCols = Math.ceil(cols / block);
  const gridRows = Math.ceil(rows / block);
  const extentH = bbox.max[2] - bbox.min[2];
  const toHeight = (value) =>
    bbox.min[2] + (value / HEIGHT_MAP_QUANT_MAX) * extentH;

  // block maximum
  const values = new Uint16Array(gridCols * gridRows);
  for (let row = 0; row < rows; row++) {
    const gr = Math.floor(row / block);
    for (let col = 0; col < cols; col++) {
      const value = data[row * cols + col];
      if (!value) continue;
      const g = gr * gridCols + Math.floor(col / block);
      if (value > values[g]) values[g] = value;
    }
  }

  // vertices (grid cells holding a surface)
  const vertexIndex = new Int32Array(gridCols * gridRows).fill(-1);
  const positions = [];
  const colors = [];
  const [rangeMin, rangeMax] = range ?? [bbox.min[2], bbox.max[2]];
  const span = rangeMax - rangeMin || 1;
  let vertexCount = 0;
  for (let gr = 0; gr < gridRows; gr++)
    for (let gc = 0; gc < gridCols; gc++) {
      const g = gr * gridCols + gc;
      const value = values[g];
      if (!value) continue;
      const h = toHeight(value);
      positions.push(
        bbox.min[0] + (gc + 0.5) * block * cellSize,
        bbox.max[1] - (gr + 0.5) * block * cellSize,
        h
      );
      const t = Math.max(0, Math.min(1, (h - rangeMin) / span));
      colors.push(...(colorAt ? colorAt(t) : [t, t, t]));
      vertexIndex[g] = vertexCount++;
    }

  // quads → two triangles, counter-clockwise seen from +h (above)
  const index = [];
  for (let gr = 0; gr < gridRows - 1; gr++)
    for (let gc = 0; gc < gridCols - 1; gc++) {
      const a = vertexIndex[gr * gridCols + gc];
      const b = vertexIndex[gr * gridCols + gc + 1];
      const c = vertexIndex[(gr + 1) * gridCols + gc + 1];
      const d = vertexIndex[(gr + 1) * gridCols + gc];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      // rows go down the image (−w): (a, d, c) and (a, c, b) face +h
      index.push(a, d, c, a, c, b);
    }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    index: new Uint32Array(index),
    vertexCount,
    triangleCount: index.length / 3,
  };
}
