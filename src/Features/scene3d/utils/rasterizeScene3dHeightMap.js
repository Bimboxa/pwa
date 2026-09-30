// Height map of a SCENE_3D scan: a top-down grid holding, per cell, the
// HIGHEST surface of the mesh ("Z max seen from above") — what the 2D
// projection shows. Built once, at import, from the geometry chunks
// (positions quantized to Uint16 on the scan bbox, see parseScenePly).
//
// Grid: `cols` × `rows` cells of `cellSize` metres, covering the XY extent
// of the scan bbox with the SAME orientation as the top view (column 0 =
// bbox min X, row 0 = bbox MAX Y — image top = scan +Y).
// Cell value (Uint16): 0 = empty (no surface), else the quantized Z on
// [bbox.min.z, bbox.max.z] (1..65535, the value 0 is folded into 1).
//
// Pure module (no DOM, no three.js): runs in the import worker and in the
// node tests.

export const HEIGHT_MAP_MAX_CELLS = 2048;
export const HEIGHT_MAP_MAX_CELLS_PER_METER = 100;
export const HEIGHT_MAP_QUANT_MAX = 65535;

// bbox: {min: [x, y, z], max: [x, y, z]} (metres, scan frame).
// → {cols, rows, cellSize, bbox, data}
export function createHeightMapRaster({
  bbox,
  maxCells = HEIGHT_MAP_MAX_CELLS,
  maxCellsPerMeter = HEIGHT_MAP_MAX_CELLS_PER_METER,
} = {}) {
  const extentX = Math.max(bbox.max[0] - bbox.min[0], 1e-6);
  const extentY = Math.max(bbox.max[1] - bbox.min[1], 1e-6);
  const cellsPerMeter = Math.min(
    maxCellsPerMeter,
    maxCells / Math.max(extentX, extentY)
  );
  const cols = Math.max(1, Math.ceil(extentX * cellsPerMeter));
  const rows = Math.max(1, Math.ceil(extentY * cellsPerMeter));
  return {
    cols,
    rows,
    cellSize: 1 / cellsPerMeter,
    bbox: { min: [...bbox.min], max: [...bbox.max] },
    data: new Uint16Array(cols * rows),
  };
}

// Stamps one geometry chunk into the raster.
// chunk: {positions: Uint16Array (xyz, normalized on the scan bbox), index:
// Uint16Array | Uint32Array}. Cells are sampled at their centre; the three
// vertices are stamped too, so a triangle smaller than a cell (or a vertical
// wall, of zero footprint) still leaves its highest point.
export function rasterizeChunk(raster, chunk) {
  const { cols, rows, cellSize, bbox, data } = raster;
  const { positions, index } = chunk;
  if (!positions || !index) return;

  const extentX = Math.max(bbox.max[0] - bbox.min[0], 1e-6);
  const extentY = Math.max(bbox.max[1] - bbox.min[1], 1e-6);
  // normalized [0..1] → cell coordinates (x to the right, y DOWN: row 0 is
  // the scan +Y side)
  const scaleX = extentX / cellSize / HEIGHT_MAP_QUANT_MAX;
  const scaleY = extentY / cellSize / HEIGHT_MAP_QUANT_MAX;
  const maxCol = cols - 1;
  const maxRow = rows - 1;

  const stamp = (col, row, value) => {
    const i = row * cols + col;
    if (value > data[i]) data[i] = value;
  };

  const cellOf = (positionIndex) => {
    const o = positionIndex * 3;
    return {
      x: positions[o] * scaleX,
      y: (HEIGHT_MAP_QUANT_MAX - positions[o + 1]) * scaleY,
      z: Math.max(1, positions[o + 2]),
    };
  };

  const triangleCount = Math.floor(index.length / 3);
  for (let t = 0; t < triangleCount; t++) {
    const a = cellOf(index[t * 3]);
    const b = cellOf(index[t * 3 + 1]);
    const c = cellOf(index[t * 3 + 2]);

    // vertices
    for (const p of [a, b, c]) {
      const col = Math.min(maxCol, Math.max(0, Math.floor(p.x)));
      const row = Math.min(maxRow, Math.max(0, Math.floor(p.y)));
      stamp(col, row, p.z);
    }

    // covered cell centres (edge functions, either winding)
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (area === 0) continue;
    const minCol = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxColT = Math.min(maxCol, Math.floor(Math.max(a.x, b.x, c.x)));
    const minRow = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxRowT = Math.min(maxRow, Math.floor(Math.max(a.y, b.y, c.y)));
    if (minCol > maxColT || minRow > maxRowT) continue;
    const invArea = 1 / area;

    for (let row = minRow; row <= maxRowT; row++) {
      const py = row + 0.5;
      for (let col = minCol; col <= maxColT; col++) {
        const px = col + 0.5;
        // barycentric weights (signed areas ÷ total area)
        const wa =
          ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * invArea;
        const wb =
          ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * invArea;
        const wc = 1 - wa - wb;
        if (wa < -1e-9 || wb < -1e-9 || wc < -1e-9) continue;
        const z = wa * a.z + wb * b.z + wc * c.z;
        stamp(
          col,
          row,
          Math.min(HEIGHT_MAP_QUANT_MAX, Math.max(1, Math.round(z)))
        );
      }
    }
  }
}
