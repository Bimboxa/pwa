import assert from "node:assert/strict";
import { test } from "node:test";

import getCutLineTranslateAxes from "./getCutLineTranslateAxes.js";

const P = (x, y, z) => ({ x, y, z });
const FLOOR = { normal: P(0, 0, 1) };
const WALL = { normal: P(0, -1, 0) };
const USER_AXES = [
  { key: "X", dir: P(1, 0, 0) },
  { key: "Y", dir: P(0, 1, 0) },
  { key: "Z", dir: P(0, 0, 1) },
];
const isAlong = (dir, ref) =>
  Math.abs(dir.x * ref.x + dir.y * ref.y + dir.z * ref.z) > 0.999;

test("segment on a floor: the perpendicular in the floor, alone", () => {
  const axes = getCutLineTranslateAxes({
    a: P(2, 1, 0),
    b: P(2, 5, 0),
    grabPlanes: [FLOOR],
    drawnPlanes: [[FLOOR], [FLOOR, WALL]],
    userAxes: USER_AXES,
  });
  assert.equal(axes.length, 1);
  assert.equal(axes[0].user, false);
  assert.ok(isAlong(axes[0].dir, P(1, 0, 0)));
});

test("oblique segment on a floor: the perpendicular, not a user axis", () => {
  const axes = getCutLineTranslateAxes({
    a: P(0, 0, 0),
    b: P(1, 1, 0),
    grabPlanes: [FLOOR],
    drawnPlanes: [[FLOOR], [FLOOR]],
    userAxes: USER_AXES,
  });
  assert.equal(axes.length, 1);
  assert.ok(isAlong(axes[0].dir, P(Math.SQRT1_2, -Math.SQRT1_2, 0)));
});

test("segment on a floor / wall edge: one perpendicular per face", () => {
  const axes = getCutLineTranslateAxes({
    a: P(0, 5, 0),
    b: P(4, 5, 0),
    grabPlanes: [FLOOR, WALL],
    drawnPlanes: [
      [FLOOR, WALL],
      [FLOOR, WALL],
    ],
    userAxes: USER_AXES,
  });
  assert.equal(axes.length, 2);
  assert.ok(axes.some((axis) => isAlong(axis.dir, P(0, 1, 0))));
  assert.ok(axes.some((axis) => isAlong(axis.dir, P(0, 0, 1))));
});

test("derived segment climbing a wall, drawn points on the floor: along the wall", () => {
  const axes = getCutLineTranslateAxes({
    a: P(2, 5, 0),
    b: P(2, 5, 3),
    grabPlanes: [WALL],
    drawnPlanes: [[FLOOR], [FLOOR, WALL]],
    userAxes: USER_AXES,
  });
  assert.equal(axes.length, 1);
  assert.ok(isAlong(axes[0].dir, P(1, 0, 0)));
});

test("line drawn on a floor then up a wall: the perpendicular would lift a point off, user axis instead", () => {
  // Grabbed on the floor part (along Y): its perpendicular X also lies in the
  // wall — still valid.
  const sliding = getCutLineTranslateAxes({
    a: P(2, 1, 0),
    b: P(2, 5, 0),
    grabPlanes: [FLOOR],
    drawnPlanes: [[FLOOR], [FLOOR, WALL], [WALL]],
    userAxes: USER_AXES,
  });
  assert.equal(sliding.length, 1);
  assert.equal(sliding[0].user, false);

  // Oblique on the floor: the perpendicular leaves the wall plane, the only
  // direction keeping the three points on their faces is the user X.
  const locked = getCutLineTranslateAxes({
    a: P(0, 3, 0),
    b: P(2, 5, 0),
    grabPlanes: [FLOOR],
    drawnPlanes: [[FLOOR], [FLOOR, WALL], [WALL]],
    userAxes: USER_AXES,
  });
  assert.deepEqual(
    locked.map((axis) => axis.key),
    ["X"]
  );
  assert.equal(locked[0].user, true);
});

test("no carrying face: the user axes, the one along the segment left out", () => {
  const axes = getCutLineTranslateAxes({
    a: P(0, 0, 1),
    b: P(3, 0, 1),
    grabPlanes: [],
    drawnPlanes: [[], []],
    userAxes: USER_AXES,
  });
  assert.deepEqual(
    axes.map((axis) => axis.key),
    ["Y", "Z"]
  );
});

test("degenerate segment: no direction", () => {
  assert.deepEqual(
    getCutLineTranslateAxes({
      a: P(1, 1, 1),
      b: P(1, 1, 1),
      grabPlanes: [FLOOR],
      userAxes: USER_AXES,
    }),
    []
  );
});
