import assert from "node:assert/strict";
import test from "node:test";
import build from "./buildLocalScanZMapGeometry.js";
import { HEIGHT_MAP_QUANT_MAX } from "../../scene3d/utils/rasterizeScene3dHeightMap.js";

// 4 × 3 map, 0.5 m cells, heights 0..2 m; one empty cell
const heightMap = {
  cols: 4,
  rows: 3,
  cellSize: 0.5,
  bbox: { min: [-1, -0.75, 0], max: [1, 0.75, 2] },
  data: new Uint16Array([
    1, 1, 1, 1, 1, HEIGHT_MAP_QUANT_MAX, 1, 1, 1, 1, 0, 1,
  ]),
};

test("vertices sit at the cell centres with their height", () => {
  const geometry = build(heightMap);
  assert.equal(geometry.vertexCount, 11);
  // first vertex: column 0, row 0 (image top = +w)
  assert.deepEqual(
    [...geometry.positions.slice(0, 3)].map((v) => +v.toFixed(3)),
    [-0.75, 0.5, 0]
  );
  // the 2 m cell (row 1, column 1)
  const z = geometry.positions[(1 * 4 + 1) * 3 + 2];
  assert.ok(Math.abs(z - 2) < 1e-6);
  // quads: 2 × 3 cells, the empty cell (row 2, column 2) breaks 2 quads
  assert.equal(geometry.triangleCount, (6 - 2) * 2);
});

test("triangles face upwards (+h) and the colour follows the range", () => {
  const geometry = build(heightMap, {
    range: [0, 2],
    colorAt: (t) => [t, 0, 1 - t],
  });
  const { positions: p, index } = geometry;
  const a = index[0] * 3,
    b = index[1] * 3,
    c = index[2] * 3;
  const ux = p[b] - p[a],
    uy = p[b + 1] - p[a + 1],
    vx = p[c] - p[a],
    vy = p[c + 1] - p[a + 1];
  assert.ok(ux * vy - uy * vx > 0, "counter-clockwise seen from above");
  const high = (1 * 4 + 1) * 3;
  assert.ok(Math.abs(geometry.colors[high] - 1) < 1e-6);
  assert.ok(Math.abs(geometry.colors[0]) < 1e-3);
});

test("a large map is downsampled by block maximum", () => {
  const cols = 1000,
    rows = 600;
  const data = new Uint16Array(cols * rows).fill(10);
  data[5 * cols + 7] = 30000;
  const geometry = build(
    { cols, rows, cellSize: 0.01, bbox: { min: [0, 0, 0], max: [10, 6, 1] }, data },
    { maxSize: 100 }
  );
  // block of 10 cells: 100 × 60 vertices
  assert.equal(geometry.vertexCount, 6000);
  assert.ok(Math.abs(geometry.positions[2] - (30000 / HEIGHT_MAP_QUANT_MAX)) < 1e-6);
});
