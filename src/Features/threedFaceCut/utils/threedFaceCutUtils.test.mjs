import assert from "node:assert/strict";
import { test } from "node:test";

import fitPlanarValue from "./fitPlanarValue.js";
import locatePlanPointOnPolyline from "./locatePlanPointOnPolyline.js";
import splitRing2dByPath, {
  locateInnerLoopInRing,
} from "./splitRing2dByPath.js";

const p = (x, y) => ({ x, y });
const near = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const SQUARE = [p(0, 0), p(4, 0), p(4, 4), p(0, 4)];
const describe = (entries) =>
  entries.map((e) =>
    e.kind === "VERTEX" ? `V${e.index}` : `${e.kind[0]}(${e.x},${e.y})`
  );

test("a straight cut from edge to edge gives two rings sharing the cut ends", () => {
  const split = splitRing2dByPath(SQUARE, [p(2, 0), p(2, 4)]);
  assert.deepEqual(describe(split.ringA), ["E(2,0)", "V1", "V2", "E(2,4)"]);
  assert.deepEqual(describe(split.ringB), ["E(2,4)", "V3", "V0", "E(2,0)"]);
  assert.equal(split.ringA[0], split.ringB[3]);
  assert.equal(split.ringA[3], split.ringB[0]);
});

test("a cut from a corner with an inner bend", () => {
  const split = splitRing2dByPath(SQUARE, [p(0, 0), p(2, 1), p(4, 4)]);
  assert.deepEqual(describe(split.ringA), ["V0", "V1", "V2", "I(2,1)"]);
  assert.deepEqual(describe(split.ringB), ["V2", "V3", "V0", "I(2,1)"]);
});

test("two cut ends on the same edge cut a notch off", () => {
  const split = splitRing2dByPath(SQUARE, [p(1, 0), p(1, 1), p(3, 1), p(3, 0)]);
  const sizes = [split.ringA.length, split.ringB.length].sort();
  assert.deepEqual(sizes, [4, 8]);
});

test("paths that do not cut in two are refused", () => {
  // Dangling end.
  assert.equal(splitRing2dByPath(SQUARE, [p(2, 0), p(2, 2)]), null);
  // Along an edge.
  assert.equal(splitRing2dByPath(SQUARE, [p(0, 0), p(4, 0)]), null);
  // Leaving the outline in between.
  assert.equal(splitRing2dByPath(SQUARE, [p(2, 0), p(5, 2), p(2, 4)]), null);
  // Outside a concave outline (L shape): the chord crosses the notch.
  const L = [p(0, 0), p(4, 0), p(4, 2), p(2, 2), p(2, 4), p(0, 4)];
  assert.equal(splitRing2dByPath(L, [p(4, 1), p(1, 4)]), null);
  // Through a hole.
  assert.equal(
    splitRing2dByPath(SQUARE, [p(2, 0), p(2, 4)], {
      holes: [[p(1.5, 1.5), p(2.5, 1.5), p(2.5, 2.5), p(1.5, 2.5)]],
    }),
    null
  );
});

test("holes go to the piece holding them", () => {
  const split = splitRing2dByPath(SQUARE, [p(2, 0), p(2, 4)], {
    holes: [
      [p(0.5, 1), p(1.5, 1), p(1.5, 2), p(0.5, 2)],
      [p(3, 1), p(3.5, 1), p(3.5, 2), p(3, 2)],
    ],
  });
  assert.deepEqual(split.holesA, [1]);
  assert.deepEqual(split.holesB, [0]);
});

test("a plan point lands on a vertex or inside a segment", () => {
  const line = [p(0, 0), p(4, 0), p(4, 3)];
  const onVertex = locatePlanPointOnPolyline(line, p(4.1, 0.005));
  assert.equal(onVertex.vertexIndex, 1);
  near(onVertex.distance, 0.1);
  const inside = locatePlanPointOnPolyline(line, p(2, 0.15));
  assert.equal(inside.segmentIndex, 0);
  near(inside.t, 0.5);
  near(inside.distance, 0.15);
  // The closing segment of a closed line.
  const closed = locatePlanPointOnPolyline(line, p(2, 1.5), {
    closeLine: true,
  });
  assert.equal(closed.segmentIndex, 2);
});

test("planar offsets are fitted, flat ones stay constant", () => {
  const flat = fitPlanarValue([
    { x: 0, y: 0, value: 0.2 },
    { x: 4, y: 0, value: 0.2 },
    { x: 4, y: 4, value: 0.2 },
  ]);
  near(flat(1, 3), 0.2);
  const slope = fitPlanarValue([
    { x: 0, y: 0, value: 0 },
    { x: 4, y: 0, value: 2 },
    { x: 4, y: 4, value: 2 },
    { x: 0, y: 4, value: 0 },
  ]);
  near(slope(2, 1), 1);
  near(slope(3, 3), 1.5);
});

test("a loop strictly inside the outline takes the holes it encloses", () => {
  const hole = [p(1.2, 1.2), p(1.4, 1.2), p(1.4, 1.4), p(1.2, 1.4)];
  const loop = [p(1, 1), p(3, 1), p(3, 3), p(1, 3)];
  assert.deepEqual(
    locateInnerLoopInRing(SQUARE, loop, {
      holes: [hole, [p(3.5, 3.5), p(3.8, 3.5), p(3.8, 3.8)]],
    }),
    { enclosedHoles: [0] }
  );
  // Touching the outline, or crossing a hole: not an inner loop.
  assert.equal(
    locateInnerLoopInRing(SQUARE, [p(0, 1), p(2, 1), p(2, 2)]),
    null
  );
  assert.equal(
    locateInnerLoopInRing(SQUARE, loop, {
      holes: [[p(2.5, 2.5), p(3.5, 2.5), p(3.5, 3.5), p(2.5, 3.5)]],
    }),
    null
  );
});
