import { test } from "node:test";
import assert from "node:assert/strict";

import getMesh3dSegmentFromQuad from "./getMesh3dSegmentFromQuad.js";

const close = (p, q) =>
  Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;

test("an axis-aligned thin quad yields its long axis", () => {
  // 4 m long, 5 mm wide, around y = 1.
  const quad = [
    { x: 0, y: 0.9975 },
    { x: 4, y: 0.9975 },
    { x: 4, y: 1.0025 },
    { x: 0, y: 1.0025 },
  ];
  const seg = getMesh3dSegmentFromQuad(quad);
  assert.ok(seg);
  assert.ok(close(seg[0], { x: 4, y: 1 }));
  assert.ok(close(seg[1], { x: 0, y: 1 }));
});

test("the vertex order of the quad does not matter", () => {
  const quad = [
    { x: 4, y: 1.0025 },
    { x: 0, y: 1.0025 },
    { x: 0, y: 0.9975 },
    { x: 4, y: 0.9975 },
  ];
  const seg = getMesh3dSegmentFromQuad(quad);
  assert.ok(close(seg[0], { x: 0, y: 1 }));
  assert.ok(close(seg[1], { x: 4, y: 1 }));
});

test("a rotated quad yields the rotated segment", () => {
  const c = Math.SQRT1_2;
  const w = 0.0025;
  // Segment from (0,0) to (3c, 3c) (length 3), normal (-c, c).
  const quad = [
    { x: 0 + w * c, y: 0 - w * c },
    { x: 3 * c + w * c, y: 3 * c - w * c },
    { x: 3 * c - w * c, y: 3 * c + w * c },
    { x: 0 - w * c, y: 0 + w * c },
  ];
  const seg = getMesh3dSegmentFromQuad(quad);
  assert.ok(close(seg[0], { x: 3 * c, y: 3 * c }));
  assert.ok(close(seg[1], { x: 0, y: 0 }));
});

test("anything but 4 finite points is not a quad", () => {
  assert.equal(getMesh3dSegmentFromQuad(null), null);
  assert.equal(
    getMesh3dSegmentFromQuad([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    null
  );
  assert.equal(
    getMesh3dSegmentFromQuad([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: NaN, y: 1 },
    ]),
    null
  );
});
