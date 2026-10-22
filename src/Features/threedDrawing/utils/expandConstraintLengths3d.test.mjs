import { test } from "node:test";
import assert from "node:assert/strict";

import expandConstraintLengths3d from "./expandConstraintLengths3d.js";

const near = (a, b) => Math.abs(a - b) < 1e-9;
const samePoint = (p, q) => near(p.x, q.x) && near(p.y, q.y) && near(p.z, q.z);

test("places one point per length, cumulated along last → direction", () => {
  const out = expandConstraintLengths3d({
    last: { x: 1, y: 2, z: 3 },
    direction: { x: 1, y: 2, z: 13 }, // +Z, 10 m away (only the direction counts)
    lengths: [2, 0.5, 1],
  });
  assert.equal(out.length, 3);
  assert.ok(samePoint(out[0], { x: 1, y: 2, z: 5 }));
  assert.ok(samePoint(out[1], { x: 1, y: 2, z: 5.5 }));
  assert.ok(samePoint(out[2], { x: 1, y: 2, z: 6.5 }));
});

test("keeps an oblique direction", () => {
  const [p] = expandConstraintLengths3d({
    last: { x: 0, y: 0, z: 0 },
    direction: { x: 3, y: 0, z: 4 },
    lengths: [10],
  });
  assert.ok(samePoint(p, { x: 6, y: 0, z: 8 }));
});

test("cursor on the last vertex falls back to +X", () => {
  const [p] = expandConstraintLengths3d({
    last: { x: 1, y: 1, z: 1 },
    direction: { x: 1, y: 1, z: 1 },
    lengths: [2],
  });
  assert.ok(samePoint(p, { x: 3, y: 1, z: 1 }));
});

test("an unusable length drops the whole series", () => {
  assert.deepEqual(
    expandConstraintLengths3d({
      last: { x: 0, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      lengths: [2, 0, 1],
    }),
    []
  );
  assert.deepEqual(
    expandConstraintLengths3d({
      last: { x: 0, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      lengths: [],
    }),
    []
  );
  assert.deepEqual(
    expandConstraintLengths3d({ last: null, direction: null, lengths: [1] }),
    []
  );
});
