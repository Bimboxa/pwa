import assert from "node:assert/strict";
import { test } from "node:test";

import computeFaceAxisCut from "./computeFaceAxisCut.js";

const p = (x, y) => ({ x, y });
const near = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );
const nearPoint = (actual, expected) => {
  near(actual.x, expected.x);
  near(actual.y, expected.y);
};

// 4 m wide, 3 m high, bottom-left at the origin.
const RECT = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)];

test("horizontal cut: chord from edge to edge at the cursor height, distance from the bottom", () => {
  const r = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(1, 1.2),
    axis: "H",
  });
  near(r.cut, 1.2);
  nearPoint(r.chord2d[0], p(0, 1.2));
  nearPoint(r.chord2d[1], p(4, 1.2));
  nearPoint(r.ref2d, p(0, 0));
  nearPoint(r.guide2d, p(0, 1.2));
  near(r.distance, 1.2);
  assert.equal(r.snapped, false);
  assert.equal(r.locked, false);
  assert.equal(r.endsOnHole, false);
});

test("vertical cut: distance from the bottom-left corner, or the bottom-right one on the RIGHT side", () => {
  const left = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(1, 1),
    axis: "V",
    side: "LEFT",
  });
  nearPoint(left.ref2d, p(0, 0));
  near(left.distance, 1);
  nearPoint(left.chord2d[0], p(1, 0));
  nearPoint(left.chord2d[1], p(1, 3));

  const right = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(1, 1),
    axis: "V",
    side: "RIGHT",
  });
  nearPoint(right.ref2d, p(4, 0));
  near(right.distance, 3);
});

test("a typed distance locks the line from the reference, toward the face", () => {
  const h = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(1, 0.3),
    axis: "H",
    typedDistance: 2,
  });
  near(h.cut, 2);
  assert.equal(h.locked, true);
  near(h.distance, 2);

  const v = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(1, 1),
    axis: "V",
    side: "RIGHT",
    typedDistance: 1,
  });
  near(v.cut, 3);
  nearPoint(v.chord2d[0], p(3, 0));
});

test("a typed distance beyond the face gives no chord, the guide still shows", () => {
  const r = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(1, 1),
    axis: "H",
    typedDistance: 10,
  });
  assert.equal(r.chord2d, null);
  nearPoint(r.guide2d, p(0, 10));
  near(r.distance, 10);
});

test("the line snaps to a vertex of a hole, and the chord stops on the hole", () => {
  const hole = [p(1, 1), p(1, 2), p(2, 2), p(2, 1)];
  const r = computeFaceAxisCut({
    loops2d: [RECT, hole],
    cursor2d: p(0.5, 1.2),
    axis: "H",
    snapToleranceM: 0.3,
  });
  near(r.cut, 1);
  assert.equal(r.snapped, true);
  nearPoint(r.chord2d[0], p(0, 1));
  nearPoint(r.chord2d[1], p(1, 1));
  assert.equal(r.loopIndexA, 0);
  assert.equal(r.loopIndexB, 1);
  assert.equal(r.endsOnHole, true);

  // Past the hole: the run on the other side, edge to edge.
  const beyond = computeFaceAxisCut({
    loops2d: [RECT, hole],
    cursor2d: p(3, 2.5),
    axis: "H",
  });
  nearPoint(beyond.chord2d[0], p(0, 2.5));
  nearPoint(beyond.chord2d[1], p(4, 2.5));
  assert.equal(beyond.endsOnHole, false);
});

test("the line snaps to the middle of an edge it would halve", () => {
  const r = computeFaceAxisCut({
    loops2d: [RECT],
    cursor2d: p(2.03, 1),
    axis: "V",
    snapToleranceM: 0.05,
  });
  near(r.cut, 2);
  assert.equal(r.snapped, true);
});

test("on a concave face the chord is the run holding the cursor", () => {
  // U shape: two 1 m legs around a notch from x = 1 to 4, above y = 1.
  const U = [
    p(0, 0),
    p(5, 0),
    p(5, 3),
    p(4, 3),
    p(4, 1),
    p(1, 1),
    p(1, 3),
    p(0, 3),
  ];
  const rightLeg = computeFaceAxisCut({
    loops2d: [U],
    cursor2d: p(4.5, 2),
    axis: "H",
  });
  nearPoint(rightLeg.chord2d[0], p(4, 2));
  nearPoint(rightLeg.chord2d[1], p(5, 2));

  const base = computeFaceAxisCut({
    loops2d: [U],
    cursor2d: p(2.5, 0.5),
    axis: "H",
  });
  nearPoint(base.chord2d[0], p(0, 0.5));
  nearPoint(base.chord2d[1], p(5, 0.5));
});

test("no contour → null", () => {
  assert.equal(
    computeFaceAxisCut({ loops2d: [], cursor2d: p(0, 0), axis: "H" }),
    null
  );
});
