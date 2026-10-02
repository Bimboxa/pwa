import assert from "node:assert/strict";
import { test } from "node:test";

import isPointInsideSoup, {
  createInsideSoupTester,
} from "./isPointInsideSoup.js";
import { boxTriangles, v, wallTriangles } from "./meshPaintTestFixtures.mjs";

test("isPointInsideSoup: box, inconsistent windings", () => {
  const box = boxTriangles(v(0, 0, 0), v(4, 2, 3), { flip: ["top", "left"] });
  assert.equal(isPointInsideSoup(v(2, 1, 1.5), box), true);
  assert.equal(isPointInsideSoup(v(5, 1, 1.5), box), false);
  assert.equal(isPointInsideSoup(v(2, 1, 3.005), box), false);
  // 5 mm probes on either side of the top face (INSIDE_PROBE_M).
  assert.equal(isPointInsideSoup(v(2, 1, 2.995), box), true);
  // Ray-unfriendly points: on the box's symmetry axes / diagonals.
  assert.equal(isPointInsideSoup(v(2, 1, 1.5 + 1e-12), box), true);
  assert.equal(isPointInsideSoup(v(1, 1, 1), box), true);
  assert.equal(isPointInsideSoup(v(-1, -1, -1), box), false);
});

test("isPointInsideSoup: wall with a door (carved shape)", () => {
  const wall = wallTriangles({ door: { x0: 2, x1: 3, h: 2.1 } });
  assert.equal(isPointInsideSoup(v(1, 0.1, 1), wall), true); // in the wall
  assert.equal(isPointInsideSoup(v(2.5, 0.1, 1), wall), false); // door gap
  assert.equal(isPointInsideSoup(v(2.5, 0.1, 2.3), wall), true); // above it
  assert.equal(isPointInsideSoup(v(1, -0.005, 1), wall), false); // 5 mm out
  assert.equal(isPointInsideSoup(v(1, 0.005, 1), wall), true); // 5 mm in
});

test("isPointInsideSoup: abutting pieces with internal partitions", () => {
  const soup = [
    ...boxTriangles(v(0, 0, 0), v(1, 1, 1)),
    ...boxTriangles(v(1, 0, 0), v(2, 1, 1)),
  ];
  assert.equal(isPointInsideSoup(v(0.5, 0.5, 0.5), soup), true);
  assert.equal(isPointInsideSoup(v(1.5, 0.5, 0.5), soup), true);
  assert.equal(isPointInsideSoup(v(2.5, 0.5, 0.5), soup), false);
});

test("createInsideSoupTester: same answers, soup prepared once", () => {
  const wall = wallTriangles({ window: { x0: 1, x1: 2, z0: 1, z1: 2 } });
  const isInside = createInsideSoupTester(wall);
  for (const p of [
    v(0.5, 0.1, 0.5),
    v(1.5, 0.1, 1.5),
    v(1.5, 0.1, 2.2),
    v(3, 0.3, 1),
  ]) {
    assert.equal(isInside(p), isPointInsideSoup(p, wall));
  }
  assert.equal(isInside(v(1.5, 0.1, 1.5)), false); // window opening
  assert.equal(createInsideSoupTester([])(v(0, 0, 0)), false);
});

test("isPointInsideSoup: empty input", () => {
  assert.equal(isPointInsideSoup(v(0, 0, 0), []), false);
  assert.equal(isPointInsideSoup(null, [0, 0, 0, 1, 0, 0, 0, 1, 0]), false);
});
