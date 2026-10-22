import { test } from "node:test";
import assert from "node:assert/strict";

import encodeDimensionChainOffsets from "./encodeDimensionChainOffsets.js";

const p = (x, y, offset) => ({ x, y, offset });

test("an in-plane chain carries no offsetZ and zero offsetBottom", () => {
  const out = encodeDimensionChainOffsets([
    p(0.1, 0.1, 0),
    p(0.5, 0.1, 0.002),
    p(0.5, 0.6, -0.001),
  ]);
  assert.equal(out.isInPlane, true);
  assert.equal(out.offsetZ, null);
  assert.deepEqual(
    out.points.map((q) => q.offsetBottom),
    [0, 0, 0]
  );
  assert.deepEqual(out.points[1], {
    x: 0.5,
    y: 0.1,
    offsetBottom: 0,
    offsetTop: 0,
  });
});

test("a lifted parallel chain keeps the level in offsetZ only", () => {
  const out = encodeDimensionChainOffsets([
    p(0.1, 0.1, 2.5),
    p(0.5, 0.1, 2.5),
    p(0.5, 0.6, 2.5),
  ]);
  assert.equal(out.isInPlane, false);
  assert.equal(out.offsetZ, 2.5);
  assert.deepEqual(
    out.points.map((q) => q.offsetBottom),
    [0, 0, 0]
  );
});

test("a chain with a riser carries the per-point altitude", () => {
  const out = encodeDimensionChainOffsets([
    p(0.1, 0.1, 0),
    p(0.5, 0.1, 0),
    p(0.5, 0.1, 2.8),
    p(0.5, 0.6, 2.8),
  ]);
  assert.equal(out.isInPlane, false);
  assert.equal(out.offsetZ, 0);
  assert.deepEqual(
    out.points.map((q) => q.offsetBottom),
    [0, 0, 2.8, 2.8]
  );
});

test("a chain below the plane gets a negative offsetZ and positive offsetBottom", () => {
  const out = encodeDimensionChainOffsets([p(0, 0, -1.2), p(1, 0, 0.3)]);
  assert.equal(out.offsetZ, -1.2);
  assert.deepEqual(
    out.points.map((q) => q.offsetBottom),
    [0, 1.5]
  );
});

test("the tolerance decides in-plane at 5 mm", () => {
  const flat = encodeDimensionChainOffsets([p(0, 0, 0), p(1, 0, 0.0049)]);
  assert.equal(flat.isInPlane, true);
  const lifted = encodeDimensionChainOffsets([p(0, 0, 0), p(1, 0, 0.006)]);
  assert.equal(lifted.isInPlane, false);
  assert.equal(lifted.offsetZ, 0);
});
