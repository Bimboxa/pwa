import assert from "node:assert/strict";
import { test } from "node:test";

import getPixelRotationAffine from "./pixelRotationAffine.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);
const apply = ({ a, b, c, d, e, f }, { x, y }) => ({
  x: a * x + b * y + c,
  y: d * x + e * y + f,
});

test("0° is the identity", () => {
  const affine = getPixelRotationAffine({
    pivotPx: { x: 7, y: 3 },
    angleDeg: 0,
  });
  const p = apply(affine, { x: 12, y: -4 });
  near(p.x, 12);
  near(p.y, -4);
});

test("90° turns +x into +y around the pivot, which stays put", () => {
  const affine = getPixelRotationAffine({
    pivotPx: { x: 10, y: 10 },
    angleDeg: 90,
  });
  const pivot = apply(affine, { x: 10, y: 10 });
  near(pivot.x, 10);
  near(pivot.y, 10);
  const p = apply(affine, { x: 20, y: 10 });
  near(p.x, 10);
  near(p.y, 20);
});

test("two half turns compose to the identity", () => {
  const affine = getPixelRotationAffine({
    pivotPx: { x: 3, y: 5 },
    angleDeg: 180,
  });
  const p = apply(affine, apply(affine, { x: 8, y: 1 }));
  near(p.x, 8);
  near(p.y, 1);
});
