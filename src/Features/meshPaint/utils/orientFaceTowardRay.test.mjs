import assert from "node:assert/strict";
import { test } from "node:test";

import { loopAreaVector } from "./meshPaintGeometry.js";
import { nearV, v } from "./meshPaintTestFixtures.mjs";
import orientFaceTowardRay from "./orientFaceTowardRay.js";

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Thin wall (plane y = 0) with a window: buildMeshDataFromRegion gives it
// some normal, the ray decides the painted side.
const wall = {
  polygons: [
    {
      contour: [v(0, 0, 0), v(4, 0, 0), v(4, 0, 2.5), v(0, 0, 2.5)],
      holes: [[v(1, 0, 1), v(1, 0, 2), v(2, 0, 2), v(2, 0, 1)]],
    },
  ],
  normal: v(0, -1, 0),
};

function assertWound(face) {
  const [polygon] = face.polygons;
  assert.ok(dot(loopAreaVector(polygon.contour), face.normal) > 0);
  assert.ok(dot(loopAreaVector(polygon.holes[0]), face.normal) < 0);
}

test("orientFaceTowardRay: viewer in front (-y) keeps -y", () => {
  const face = orientFaceTowardRay(wall, v(0.3, 1, -0.2));
  nearV(face.normal, v(0, -1, 0));
  assertWound(face);
});

test("orientFaceTowardRay: viewer behind (+y) flips to +y, loops re-wound", () => {
  const face = orientFaceTowardRay(wall, v(-0.1, -1, 0.4));
  nearV(face.normal, v(0, 1, 0));
  assertWound(face);
  // Input untouched.
  nearV(wall.normal, v(0, -1, 0));
});

test("orientFaceTowardRay: grazing ray keeps the face's own side", () => {
  const face = orientFaceTowardRay(wall, v(1, 0, 0));
  nearV(face.normal, v(0, -1, 0));
});
