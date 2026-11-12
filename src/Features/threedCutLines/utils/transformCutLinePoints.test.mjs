import assert from "node:assert/strict";
import { test } from "node:test";

import transformCutLinePoints from "./transformCutLinePoints.js";

const LINE = [
  { x: 0, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 2, y: 0, z: 3 },
];

function assertPointsClose(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((p, i) => {
    assert.ok(Math.abs(p.x - expected[i].x) < 1e-9, `x of point ${i}`);
    assert.ok(Math.abs(p.y - expected[i].y) < 1e-9, `y of point ${i}`);
    assert.ok(Math.abs(p.z - expected[i].z) < 1e-9, `z of point ${i}`);
  });
}

test("MOVE translates every point, altitude included", () => {
  const moved = transformCutLinePoints(LINE, {
    kind: "MOVE",
    delta: { x: 1, y: -2, z: 0.5 },
  });
  assertPointsClose(moved, [
    { x: 1, y: -2, z: 0.5 },
    { x: 3, y: -2, z: 0.5 },
    { x: 3, y: -2, z: 3.5 },
  ]);
});

test("MOVE copy i sits at i times the delta", () => {
  const moved = transformCutLinePoints(
    LINE,
    { kind: "MOVE", delta: { x: 1, y: 0, z: 0 } },
    3
  );
  assertPointsClose(moved, [
    { x: 3, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 5, y: 0, z: 3 },
  ]);
});

test("ROTATE turns about the plan normal through the pivot", () => {
  const turned = transformCutLinePoints(LINE, {
    kind: "ROTATE",
    pivot: { x: 2, y: 0 },
    phi: Math.PI / 2,
  });
  assertPointsClose(turned, [
    { x: 2, y: -2, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 0, z: 3 },
  ]);
});

test("ROTATE copy i is turned by i times the angle", () => {
  const turned = transformCutLinePoints(
    LINE,
    { kind: "ROTATE", pivot: { x: 0, y: 0 }, phi: Math.PI / 2 },
    2
  );
  assertPointsClose(turned, [
    { x: 0, y: 0, z: 0 },
    { x: -2, y: 0, z: 0 },
    { x: -2, y: 0, z: 3 },
  ]);
});

test("does not mutate the input and refuses an unknown transform", () => {
  const copy = LINE.map((p) => ({ ...p }));
  transformCutLinePoints(LINE, { kind: "MOVE", delta: { x: 1, y: 1, z: 1 } });
  assert.deepEqual(LINE, copy);
  assert.equal(transformCutLinePoints(LINE, { kind: "SCALE" }), null);
  assert.equal(transformCutLinePoints(LINE, null), null);
});
