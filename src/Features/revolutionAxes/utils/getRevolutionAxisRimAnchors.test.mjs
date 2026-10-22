import assert from "node:assert/strict";
import { test } from "node:test";

import getRevolutionAxisRimAnchors from "./getRevolutionAxisRimAnchors.js";

const EPS = 1e-9;
const near = (p, x, y) => {
  assert.ok(Math.abs(p.x - x) < EPS, `x ${p.x} ≠ ${x}`);
  assert.ok(Math.abs(p.y - y) < EPS, `y ${p.y} ≠ ${y}`);
};
const sortByX = (pts) => [...pts].sort((a, b) => a.x - b.x || a.y - b.y);

test("full circle: the two diameter ends along directionDeg", () => {
  const pts = getRevolutionAxisRimAnchors({
    cx: 10,
    cy: 5,
    r: 2,
    annotation: { directionDeg: 0 },
  });
  assert.equal(pts.length, 2);
  const [a, b] = sortByX(pts);
  near(a, 8, 5);
  near(b, 12, 5);
});

test("full circle: directionDeg rotates CCW in the y-up local frame", () => {
  const [a, b] = sortByX(
    getRevolutionAxisRimAnchors({
      cx: 0,
      cy: 0,
      r: 1,
      annotation: { directionDeg: 90 },
    })
  );
  near(a, 0, -1);
  near(b, 0, 1);
});

test("full circle: invertHalf does not change the pair of ends", () => {
  const base = sortByX(
    getRevolutionAxisRimAnchors({
      cx: 1,
      cy: 2,
      r: 3,
      annotation: { directionDeg: 30 },
    })
  );
  const inverted = sortByX(
    getRevolutionAxisRimAnchors({
      cx: 1,
      cy: 2,
      r: 3,
      annotation: { directionDeg: 30, invertHalf: true },
    })
  );
  base.forEach((p, i) => near(inverted[i], p.x, p.y));
});

test("partial revolution: the START and END sector ends", () => {
  const [start, end] = getRevolutionAxisRimAnchors({
    cx: 0,
    cy: 0,
    r: 2,
    annotation: {
      partialRevolution: true,
      revolutionAngleStartDeg: 0,
      revolutionAngleEndDeg: 90,
      directionDeg: 45, // ignored for a sector
    },
  });
  near(start, 2, 0);
  near(end, 0, 2);
});

test("no radius / no annotation: nothing to snap", () => {
  assert.deepEqual(
    getRevolutionAxisRimAnchors({ cx: 0, cy: 0, r: 0, annotation: {} }),
    []
  );
  assert.deepEqual(
    getRevolutionAxisRimAnchors({ cx: 0, cy: 0, r: 2, annotation: null }),
    []
  );
});
