import assert from "node:assert/strict";
import { test } from "node:test";

import mapPaintGeometryXY from "./mapPaintGeometryXY.js";

const shift = ({ x, y }) => ({ x: x * 2 + 0.1, y: y * 2 - 0.1 });

test("FACE: contour and holes mapped, z and normal kept", () => {
  const geometry = {
    polygons: [
      {
        contour: [
          [0, 0, 1],
          [0.5, 0, 1],
          [0.5, 0.5, 1],
        ],
        holes: [
          [
            [0.1, 0.1, 1],
            [0.2, 0.1, 1],
            [0.2, 0.2, 1],
          ],
        ],
      },
    ],
    normal: [0, 0, 1],
  };
  const out = mapPaintGeometryXY("FACE", geometry, shift);
  assert.deepEqual(out.polygons[0].contour[1], [1.1, -0.1, 1]);
  assert.deepEqual(out.polygons[0].holes[0][2], [0.5, 0.30000000000000004, 1]);
  assert.deepEqual(out.normal, [0, 0, 1]);
  // Source untouched.
  assert.deepEqual(geometry.polygons[0].contour[1], [0.5, 0, 1]);
});

test("EDGE: points mapped, sides kept", () => {
  const geometry = {
    points: [
      [0, 0, 2.5],
      [0.25, 0, 2.5],
    ],
    sides: [[0, -1, 0]],
  };
  const out = mapPaintGeometryXY("EDGE", geometry, shift);
  assert.deepEqual(out.points, [
    [0.1, -0.1, 2.5],
    [0.6, -0.1, 2.5],
  ]);
  assert.deepEqual(out.sides, [[0, -1, 0]]);
});

test("missing geometry or mapper: returned as is", () => {
  assert.equal(mapPaintGeometryXY("FACE", null, shift), null);
  const geometry = { points: [] };
  assert.equal(mapPaintGeometryXY("EDGE", geometry, null), geometry);
});
