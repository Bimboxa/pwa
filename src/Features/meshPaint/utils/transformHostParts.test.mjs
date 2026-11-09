import assert from "node:assert/strict";
import { test } from "node:test";

import {
  IDENTITY_MAT4,
  applyMat4Normal,
  applyMat4Point,
  invertMat4,
  multiplyMat4,
  transformHostParts,
  transformLocalGeometry,
} from "./transformHostParts.js";
import { nearV, v } from "./meshPaintTestFixtures.mjs";

// column-major: rotation of 90° about z then translation (2, 3, 4)
const ROT_Z_90_T = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1];

test("point / normal through a rigid matrix", () => {
  nearV(applyMat4Point(ROT_Z_90_T, v(1, 0, 0)), v(2, 4, 4));
  nearV(applyMat4Normal(ROT_Z_90_T, v(1, 0, 0)), v(0, 1, 0));
  nearV(applyMat4Normal(ROT_Z_90_T, v(0, 0, 2)), v(0, 0, 1)); // normalized
});

test("inverse and product", () => {
  const inv = invertMat4(ROT_Z_90_T);
  const id = multiplyMat4(ROT_Z_90_T, inv);
  id.forEach((x, i) => assert.ok(Math.abs(x - IDENTITY_MAT4[i]) < 1e-12));
  nearV(applyMat4Point(inv, applyMat4Point(ROT_Z_90_T, v(0.3, -0.7, 1.1))), v(0.3, -0.7, 1.1));
  assert.equal(invertMat4(new Array(16).fill(0)), null);
});

test("host parts and local geometries move together", () => {
  const index = {
    islands: [
      {
        polygons: [{ contour: [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0)], holes: [] }],
        normal: v(0, 0, 1),
        centroid: v(2 / 3, 1 / 3, 0),
        area: 0.5,
      },
    ],
    chains: [{ points: [v(0, 0, 0), v(1, 0, 0)], length: 1, sides: [v(0, 0, 1)] }],
  };
  const moved = transformHostParts(index, ROT_Z_90_T);
  nearV(moved.islands[0].polygons[0].contour[1], v(2, 4, 4));
  nearV(moved.islands[0].normal, v(0, 0, 1));
  nearV(moved.chains[0].points[1], v(2, 4, 4));
  nearV(moved.box.min, v(1, 3, 4));
  nearV(moved.box.max, v(2, 4, 4));
  const edge = transformLocalGeometry("EDGE", { points: [v(0, 0, 0)], sides: [v(1, 0, 0)] }, ROT_Z_90_T);
  nearV(edge.points[0], v(2, 3, 4));
  nearV(edge.sides[0], v(0, 1, 0));
  const face = transformLocalGeometry(
    "FACE",
    { polygons: [{ contour: [v(1, 0, 0)], holes: [[v(0, 1, 0)]] }], normal: v(0, 1, 0) },
    ROT_Z_90_T
  );
  nearV(face.polygons[0].holes[0][0], v(1, 3, 4));
  nearV(face.normal, v(-1, 0, 0));
});
