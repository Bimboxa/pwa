import assert from "node:assert/strict";
import { test } from "node:test";

import isDegenerateRing from "./isDegenerateRing.js";

const square = (x, y) => ({ x, y, type: "square" });
const circle = (x, y) => ({ x, y, type: "circle" });

test("a ring whose points all sit at the same place is degenerate", () => {
  const ring = [1, 2, 3, 4].map(() => square(3707.298, 3066.539));
  assert.equal(isDegenerateRing(ring), true);
});

test("aligned points enclose no area", () => {
  assert.equal(
    isDegenerateRing([square(0, 0), square(5, 5), square(10, 10)]),
    true
  );
});

test("fewer than 3 points, or no ring at all, is degenerate", () => {
  assert.equal(isDegenerateRing([square(0, 0), square(10, 0)]), true);
  assert.equal(isDegenerateRing([]), true);
  assert.equal(isDegenerateRing(null), true);
});

test("a plain square is a valid ring, in pixels as in meters", () => {
  const ring = (s) => [square(0, 0), square(s, 0), square(s, s), square(0, s)];
  assert.equal(isDegenerateRing(ring(200)), false);
  assert.equal(isDegenerateRing(ring(0.002)), false);
});

test("a circle made of 2 squares + 2 arc control points is valid", () => {
  const ring = [square(-1, 0), circle(0, -1), square(1, 0), circle(0, 1)];
  assert.equal(isDegenerateRing(ring), false);
});

test("duplicate consecutive points do not make a real hole degenerate", () => {
  const ring = [
    square(0, 0),
    square(10, 0),
    square(10, 0),
    square(10, 10),
    square(0, 10),
  ];
  assert.equal(isDegenerateRing(ring), false);
});
