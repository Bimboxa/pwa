// Run with: npx vite-node src/Features/orthophotos/utils/getOrthophotoPlacement.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import computeQuadHomography, {
  applyHomography,
} from "./computeQuadHomography.js";
import getOrthophotoPlacement, {
  getDefaultOrthophotoCorners,
} from "./getOrthophotoPlacement.js";

const EPS = 1e-9;
const UNIT = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function assertPoint(actual, expected, eps = EPS) {
  assert.ok(actual, "point expected");
  assert.ok(Math.abs(actual.x - expected.x) < eps, `x ${actual.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < eps, `y ${actual.y}`);
}

test("homography maps the unit square corners onto the quad", () => {
  const quad = [
    { x: 120, y: 80 },
    { x: 910, y: 140 },
    { x: 840, y: 700 },
    { x: 60, y: 620 },
  ];
  const H = computeQuadHomography(quad);
  assert.ok(H);
  UNIT.forEach((u, i) => assertPoint(applyHomography(H, u), quad[i], 1e-6));
  // Projective: the centre is NOT the corners' average.
  const centre = applyHomography(H, { x: 0.5, y: 0.5 });
  const avg = {
    x: quad.reduce((s, p) => s + p.x, 0) / 4,
    y: quad.reduce((s, p) => s + p.y, 0) / 4,
  };
  assert.ok(Math.hypot(centre.x - avg.x, centre.y - avg.y) > 1);
});

test("homography of a parallelogram is affine", () => {
  const quad = [
    { x: 10, y: 20 },
    { x: 110, y: 40 },
    { x: 90, y: 140 },
    { x: -10, y: 120 },
  ];
  const H = computeQuadHomography(quad);
  assert.equal(H[6], 0);
  assert.equal(H[7], 0);
  assertPoint(applyHomography(H, { x: 0.5, y: 0.5 }), { x: 50, y: 80 });
});

test("degenerate quads are rejected", () => {
  assert.equal(computeQuadHomography(null), null);
  assert.equal(computeQuadHomography(UNIT.slice(0, 3)), null);
  assert.equal(
    computeQuadHomography([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]),
    null
  );
});

test("placement: rotated rectangle -> AFFINE matrix on the image px", () => {
  const baseMapSize = { width: 2000, height: 1000 };
  const imageSize = { width: 400, height: 200 };
  // 400x200 image rotated 90° clockwise, top-left at (1000, 300) px.
  const cornersPx = [
    { x: 1000, y: 300 },
    { x: 1000, y: 700 },
    { x: 800, y: 700 },
    { x: 800, y: 300 },
  ];
  const corners = cornersPx.map((p) => ({ x: p.x / 2000, y: p.y / 1000 }));
  const placement = getOrthophotoPlacement({ corners, baseMapSize, imageSize });
  assert.equal(placement.kind, "AFFINE");
  const { a, b, c, d, e, f } = placement.matrix;
  const apply = (p) => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f });
  assertPoint(apply({ x: 0, y: 0 }), cornersPx[0], 1e-6);
  assertPoint(apply({ x: 400, y: 0 }), cornersPx[1], 1e-6);
  assertPoint(apply({ x: 400, y: 200 }), cornersPx[2], 1e-6);
  assertPoint(apply({ x: 0, y: 200 }), cornersPx[3], 1e-6);
  assert.deepEqual(placement.bbox, { x: 800, y: 300, width: 200, height: 400 });
  assert.ok(placement.matrixStr.startsWith("matrix("));
});

test("placement: skewed quad -> PROJECTIVE", () => {
  const placement = getOrthophotoPlacement({
    corners: [
      { x: 0.1, y: 0.1 },
      { x: 0.6, y: 0.15 },
      { x: 0.55, y: 0.7 },
      { x: 0.05, y: 0.5 },
    ],
    baseMapSize: { width: 1000, height: 1000 },
    imageSize: { width: 300, height: 300 },
  });
  assert.equal(placement.kind, "PROJECTIVE");
  assertPoint(
    applyHomography(placement.H, { x: 1, y: 1 }),
    { x: 550, y: 700 },
    1e-6
  );
});

test("placement: invalid inputs -> null", () => {
  const baseMapSize = { width: 1000, height: 1000 };
  const imageSize = { width: 300, height: 300 };
  assert.equal(
    getOrthophotoPlacement({ corners: null, baseMapSize, imageSize }),
    null
  );
  assert.equal(
    getOrthophotoPlacement({
      corners: UNIT.slice(0, 3),
      baseMapSize,
      imageSize,
    }),
    null
  );
  assert.equal(
    getOrthophotoPlacement({ corners: UNIT, baseMapSize: null, imageSize }),
    null
  );
});

test("default corners keep the image aspect ratio, centered", () => {
  const baseMapSize = { width: 3000, height: 2000 };
  const corners = getDefaultOrthophotoCorners({
    baseMapSize,
    imageSize: { width: 800, height: 400 },
  });
  const wPx = (corners[1].x - corners[0].x) * 3000;
  const hPx = (corners[3].y - corners[0].y) * 2000;
  assert.ok(Math.abs(wPx - 1000) < 1e-6);
  assert.ok(Math.abs(hPx - 500) < 1e-6);
  assert.ok(Math.abs(corners[0].x + corners[1].x - 1) < 1e-9);
  assert.ok(Math.abs(corners[0].y + corners[3].y - 1) < 1e-9);
});
