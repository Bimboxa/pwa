import assert from "node:assert/strict";
import { test } from "node:test";

import clipScene3dChunk, { pointInPolygon } from "./clipScene3dChunk.js";

const QUANT_MAX = 65535;
const q = (value) => Math.round(value * QUANT_MAX);
const near = (a, b, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// scan of 2 m × 1 m × 1 m (z from 10 to 11)
const bbox = { min: [0, 0, 10], max: [2, 1, 11] };

// two quads: left one at z = 0.25, right one rising to z = 1 — normalized
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
  return {
    positions: new Uint16Array(vertices.flat().map(q)),
    uvs: new Uint16Array(vertices.flatMap((_, i) => [i * 100, i * 200])),
    index: new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
  };
}

test("pointInPolygon: even-odd, concave polygon", () => {
  const polygon = [
    [0, 0],
    [4, 0],
    [4, 4],
    [2, 1],
    [0, 4],
  ];
  assert.equal(pointInPolygon(1, 0.5, polygon), true);
  assert.equal(pointInPolygon(2, 3, polygon), false); // in the notch
  assert.equal(pointInPolygon(5, 1, polygon), false);
});

test("keeps the triangles whose centroid is inside, compacts vertices", () => {
  // left half of the scan only (x < 1 m)
  const polygon = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const clipped = clipScene3dChunk(buildChunk(), bbox, polygon);
  assert.equal(clipped.triangleCount, 2);
  assert.equal(clipped.vertexCount, 4);
  assert.equal(clipped.index.length, 6);
  assert.ok(clipped.index.every((i) => i < 4));
  // uvs follow the remap (vertex 0 keeps its uv)
  assert.equal(clipped.uvs.length, 8);
  assert.equal(clipped.uvs[0], 0);
  assert.equal(clipped.uvs[2], 100);
  near(clipped.boundsMax[0], 0.5);
  near(clipped.zMin, 10.25);
  near(clipped.zMax, 10.25);
});

test("triangles straddling the edge follow their centroid", () => {
  // x < 1.4 m: the right quad's triangles have centroids at x = 1.67 and
  // x = 1.33 m (normalized 0.83 / 0.67 of the 2 m extent)
  const polygon = [
    [0, 0],
    [1.4, 0],
    [1.4, 1],
    [0, 1],
  ];
  const clipped = clipScene3dChunk(buildChunk(), bbox, polygon);
  assert.equal(clipped.triangleCount, 3);
  near(clipped.zMin, 10);
  near(clipped.zMax, 11);
});

test("nothing kept → null", () => {
  const polygon = [
    [5, 5],
    [6, 5],
    [6, 6],
  ];
  assert.equal(clipScene3dChunk(buildChunk(), bbox, polygon), null);
});

test("untextured chunk (no uvs)", () => {
  const chunk = buildChunk();
  chunk.uvs = null;
  const clipped = clipScene3dChunk(chunk, bbox, [
    [-1, -1],
    [3, -1],
    [3, 2],
    [-1, 2],
  ]);
  assert.equal(clipped.uvs, null);
  assert.equal(clipped.triangleCount, 4);
  assert.equal(clipped.vertexCount, 8);
});
