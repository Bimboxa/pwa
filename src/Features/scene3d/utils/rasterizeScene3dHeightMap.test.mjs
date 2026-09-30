import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createHeightMapRaster,
  rasterizeChunk,
  HEIGHT_MAP_QUANT_MAX,
} from "./rasterizeScene3dHeightMap.js";
import sampleScene3dHeightMap from "./sampleScene3dHeightMap.js";
import getScene3dHeightAtPx from "./getScene3dHeightAtPx.js";

const near = (a, b, eps = 1e-3) =>
  assert.ok(a !== null && Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// scan of 2 m × 1 m, z in [0, 1]
const bbox = { min: [0, 0, 0], max: [2, 1, 1] };
const q = (value) => Math.round(value * HEIGHT_MAP_QUANT_MAX);

// two quads: left one flat at z = 0.25, right one rising from z = 0 (x = 1)
// to z = 1 (x = 2) — normalized on the bbox
function buildChunk() {
  const vertices = [
    [0, 0, 0.25],
    [0.5, 0, 0.25],
    [0.5, 1, 0.25],
    [0, 1, 0.25],
    [0.5, 0, 0],
    [1, 0, 1],
    [1, 1, 1],
    [0.5, 1, 0],
  ];
  const positions = new Uint16Array(vertices.flat().map(q));
  const index = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return { positions, index };
}

test("raster size follows the resolution caps", () => {
  const r = createHeightMapRaster({ bbox, maxCells: 100 });
  assert.equal(r.cols, 100);
  assert.equal(r.rows, 50);
  near(r.cellSize, 0.02);
  const fine = createHeightMapRaster({ bbox });
  near(fine.cellSize, 0.01);
  assert.equal(fine.cols, 200);
});

test("rasterized quads: flat left, ramp right, +Y at row 0", () => {
  const raster = createHeightMapRaster({ bbox, maxCells: 100 });
  rasterizeChunk(raster, buildChunk());
  near(sampleScene3dHeightMap(raster, 0.5, 0.5), 0.25, 1e-2);
  near(sampleScene3dHeightMap(raster, 1.5, 0.5), 0.5, 2e-2);
  near(sampleScene3dHeightMap(raster, 1.9, 0.9), 0.9, 2e-2);
  // no empty cell inside the footprint
  assert.ok(raster.data.every((v) => v > 0));
  // outside the grid
  assert.equal(sampleScene3dHeightMap(raster, -0.1, 0.5), null);
  assert.equal(sampleScene3dHeightMap(raster, 0.5, 1.2), null);
});

test("overlapping surfaces keep the highest one; holes stay empty", () => {
  const raster = createHeightMapRaster({ bbox, maxCells: 100 });
  const low = {
    positions: new Uint16Array([0, 0, 0, 1, 0, 0, 1, 1, 0].map(q)),
    index: new Uint16Array([0, 1, 2]),
  };
  const high = {
    positions: new Uint16Array(
      [0.4, 0.1, 0.8, 0.6, 0.1, 0.8, 0.6, 0.3, 0.8].map(q)
    ),
    index: new Uint16Array([0, 1, 2]),
  };
  rasterizeChunk(raster, low);
  rasterizeChunk(raster, high);
  near(sampleScene3dHeightMap(raster, 1.05, 0.2), 0.8, 1e-2);
  // the lower triangle covers x > y only (in normalized space): the other
  // half is a hole
  assert.equal(sampleScene3dHeightMap(raster, 0.2, 0.9), null);
});

test("getScene3dHeightAtPx: scan base map, zone rotated 90°", () => {
  const raster = createHeightMapRaster({ bbox, maxCells: 100 });
  rasterizeChunk(raster, buildChunk());
  // Zone = the whole scan, θ = 90° (zone +X = scan +Y): the image is 1 m
  // wide (scan Y) × 2 m high (scan X), 0.01 m / px → 100 × 200 px, centred
  // on the scan centre (1, 0.5); plane at zMin = 0.
  const baseMap = {
    scene3d: {
      bbox,
      zone: {
        rotationDeg: 90,
        center: [1, 0.5],
        width: 1,
        height: 2,
        zMin: 0,
        zMax: 1,
      },
    },
    imageSize: { width: 100, height: 200 },
    meterByPx: 0.01,
  };
  // image top = zone +Y = scan −X → the ramp's high end (scan x = 1.9) is
  // near the image bottom: q = R(−90°)·(0.9, 0.4) = (0.4, −0.9) → px (90, 190)
  near(getScene3dHeightAtPx(baseMap, { x: 90, y: 190 }, raster), 0.9, 2e-2);
  // left flat quad: scan (0.5, 0.5) → q = (0, 0.5) → px (50, 50)
  near(getScene3dHeightAtPx(baseMap, { x: 50, y: 50 }, raster), 0.25, 1e-2);
  // outside the zone
  assert.equal(getScene3dHeightAtPx(baseMap, { x: -10, y: 0 }, raster), null);
});
