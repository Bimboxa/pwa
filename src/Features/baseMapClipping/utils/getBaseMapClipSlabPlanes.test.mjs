import assert from "node:assert/strict";
import test from "node:test";

import getBaseMapClipSlabPlanes from "./getBaseMapClipSlabPlanes.js";

const keeps = (planes, p) =>
  planes.every(
    ({ normal, constant }) =>
      normal.x * p.x + normal.y * p.y + normal.z * p.z + constant >= -1e-9
  );

test("horizontal base map: slab along world Y around its altitude", () => {
  const planes = getBaseMapClipSlabPlanes({
    orientation: "HORIZONTAL",
    position: { x: 0, y: 2, z: 0 },
    clipping3d: { frontM: 0.5, backM: 0.2 },
  });
  assert.equal(planes.length, 2);
  assert.ok(keeps(planes, { x: 5, y: 2, z: -3 }));
  assert.ok(keeps(planes, { x: 0, y: 2.5, z: 0 }));
  assert.ok(!keeps(planes, { x: 0, y: 2.51, z: 0 }));
  assert.ok(keeps(planes, { x: 0, y: 1.8, z: 0 }));
  assert.ok(!keeps(planes, { x: 0, y: 1.79, z: 0 }));
});

test("vertical base map: front is its +Z normal, turned by angleDeg", () => {
  // angle 0: normal = world +Z
  const facingZ = getBaseMapClipSlabPlanes({
    orientation: "VERTICAL",
    angleDeg: 0,
    position: { x: 0, y: 0, z: 1 },
    clipping3d: { frontM: 0.3, backM: 0.1 },
  });
  assert.ok(keeps(facingZ, { x: 9, y: 9, z: 1.3 }));
  assert.ok(!keeps(facingZ, { x: 0, y: 0, z: 1.31 }));
  assert.ok(keeps(facingZ, { x: 0, y: 0, z: 0.9 }));
  assert.ok(!keeps(facingZ, { x: 0, y: 0, z: 0.89 }));

  // angle 90°: normal = world +X
  const facingX = getBaseMapClipSlabPlanes({
    orientation: "VERTICAL",
    angleDeg: 90,
    position: { x: 4, y: 0, z: 0 },
    clipping3d: { frontM: 0.3, backM: 0.1 },
  });
  assert.ok(keeps(facingX, { x: 4.3, y: 0, z: 7 }));
  assert.ok(!keeps(facingX, { x: 4.31, y: 0, z: 0 }));
  assert.ok(!keeps(facingX, { x: 3.89, y: 0, z: 0 }));
});

test("null depth leaves the side open, missing depth uses the default", () => {
  const openBack = getBaseMapClipSlabPlanes({
    orientation: "HORIZONTAL",
    clipping3d: { frontM: 0.5, backM: null },
  });
  assert.equal(openBack.length, 1);
  assert.ok(keeps(openBack, { x: 0, y: -1000, z: 0 }));
  assert.ok(!keeps(openBack, { x: 0, y: 0.6, z: 0 }));

  const defaults = getBaseMapClipSlabPlanes({ orientation: "HORIZONTAL" });
  assert.equal(defaults.length, 2);
  assert.ok(keeps(defaults, { x: 0, y: 0.1, z: 0 }));
  assert.ok(!keeps(defaults, { x: 0, y: 0.11, z: 0 }));
  assert.ok(!keeps(defaults, { x: 0, y: -0.11, z: 0 }));
});
