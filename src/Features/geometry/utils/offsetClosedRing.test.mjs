import assert from "node:assert/strict";
import { test } from "node:test";

import offsetClosedRing from "./offsetClosedRing.js";

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];
const REVERSED = [SQUARE[0], SQUARE[3], SQUARE[2], SQUARE[1]];

const assertClose = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((p, i) => {
    assert.ok(Math.abs(p.x - expected[i].x) < 1e-9, `x of point ${i}`);
    assert.ok(Math.abs(p.y - expected[i].y) < 1e-9, `y of point ${i}`);
  });
};

test("a positive distance grows the ring, keeping order and start point", () => {
  assertClose(offsetClosedRing(SQUARE, 2), [
    { x: -2, y: -2 },
    { x: 12, y: -2 },
    { x: 12, y: 12 },
    { x: -2, y: 12 },
  ]);
});

test("a negative distance shrinks the ring", () => {
  assertClose(offsetClosedRing(SQUARE, -2), [
    { x: 2, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 8 },
    { x: 2, y: 8 },
  ]);
});

test("the sign does not depend on the drawing direction", () => {
  assertClose(offsetClosedRing(REVERSED, 2), [
    { x: -2, y: -2 },
    { x: -2, y: 12 },
    { x: 12, y: 12 },
    { x: 12, y: -2 },
  ]);
});

test("the POLYLINE -> STRIP A -> STRIP B -> POLYLINE cycle comes back", () => {
  const W = 3;
  const sideA = offsetClosedRing(SQUARE, -W / 2);
  const sideB = offsetClosedRing(sideA, W);
  const back = offsetClosedRing(sideB, -W / 2);
  assertClose(back, SQUARE);
});

test("a concave ring keeps its point count", () => {
  const lShape = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 20 },
    { x: 0, y: 20 },
  ];
  assertClose(offsetClosedRing(lShape, -1), [
    { x: 1, y: 1 },
    { x: 19, y: 1 },
    { x: 19, y: 9 },
    { x: 9, y: 9 },
    { x: 9, y: 19 },
    { x: 1, y: 19 },
  ]);
});

test("an inward offset larger than the ring allows is refused", () => {
  assert.equal(offsetClosedRing(SQUARE, -5), null);
  assert.equal(offsetClosedRing(SQUARE, -6), null);
});

test("fewer than 3 points is refused", () => {
  assert.equal(offsetClosedRing(SQUARE.slice(0, 2), 1), null);
});
