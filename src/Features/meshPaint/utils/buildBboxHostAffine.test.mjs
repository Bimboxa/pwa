import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bboxCenterPx,
  bboxHostMoveAffine,
  bboxHostRotationAffine,
} from "./buildBboxHostAffine.js";

const apply = ({ a, b, c, d, e, f }, p) => ({
  x: a * p.x + b * p.y + c,
  y: d * p.x + e * p.y + f,
});
const near = (p, q, tol = 1e-9) =>
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;

test("move affine translates by the pixel delta", () => {
  const affine = bboxHostMoveAffine({ x: 10, y: -4 });
  assert.ok(near(apply(affine, { x: 100, y: 50 }), { x: 110, y: 46 }));
});

test("rotation affine matches the 2D editor's ROTATE formula", () => {
  const center = { x: 100, y: 100 };
  const deltaDeg = 90;
  const affine = bboxHostRotationAffine({ deltaDeg, center });
  // applyWrapperTransformToPoints ROTATE reference.
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const reference = (p) => ({
    x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
    y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
  });
  for (const p of [
    { x: 150, y: 100 },
    { x: 100, y: 30 },
    { x: 12, y: 250 },
  ]) {
    assert.ok(near(apply(affine, p), reference(p)));
  }
  // The pivot stays put; +90° sends +x to +y (clockwise on a y-down screen).
  assert.ok(near(apply(affine, center), center));
  assert.ok(near(apply(affine, { x: 150, y: 100 }), { x: 100, y: 150 }));
});

test("zero rotation is the identity", () => {
  const affine = bboxHostRotationAffine({
    deltaDeg: 0,
    center: { x: 3, y: 7 },
  });
  assert.ok(near(apply(affine, { x: 20, y: 40 }), { x: 20, y: 40 }));
});

test("bbox center in pixels", () => {
  assert.deepEqual(bboxCenterPx({ x: 10, y: 20, width: 30, height: 40 }), {
    x: 25,
    y: 40,
  });
});
