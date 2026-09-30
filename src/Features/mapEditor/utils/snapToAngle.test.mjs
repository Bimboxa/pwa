import assert from "node:assert/strict";
import { test } from "node:test";
import snapToAngle from "./snapToAngle.js";

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

const toRad = (deg) => (deg * Math.PI) / 180;

// Point at `dist` from `origin` in direction `angleDeg`
const polar = (origin, angleDeg, dist) => ({
  x: origin.x + dist * Math.cos(toRad(angleDeg)),
  y: origin.y + dist * Math.sin(toRad(angleDeg)),
});

const angleOf = (from, to) =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

const LAST = { x: 100, y: 50 };

test("no last point: returns the cursor untouched", () => {
  const pos = { x: 3, y: 4 };
  assert.equal(snapToAngle(pos, null), pos);
});

test("grid only: snaps to 0 / 45 / 90", () => {
  near(angleOf(LAST, snapToAngle(polar(LAST, 4, 80), LAST)), 0, 1e-9, "0°");
  near(angleOf(LAST, snapToAngle(polar(LAST, 41, 80), LAST)), 45, 1e-9, "45°");
  near(angleOf(LAST, snapToAngle(polar(LAST, 93, 80), LAST)), 90, 1e-9, "90°");
});

test("grid only: the cursor is projected on the snapped direction", () => {
  const snapped = snapToAngle(polar(LAST, 10, 80), LAST);
  near(snapped.y, LAST.y, 1e-9, "y stays on the axis");
  near(snapped.x - LAST.x, 80 * Math.cos(toRad(10)), 1e-9, "projected length");
});

test("grid only: the offset rotates the grid", () => {
  const snapped = snapToAngle(polar(LAST, -8, 80), LAST, 10);
  near(angleOf(LAST, snapped), -10, 1e-9, "rotated grid");
});

test("last segment at 17°: snaps on its extension", () => {
  const prev = polar(LAST, 17 + 180, 60);
  const snapped = snapToAngle(polar(LAST, 20, 80), LAST, 0, 45, prev);
  near(angleOf(LAST, snapped), 17, 1e-9, "extension");
});

test("last segment at 17°: snaps on its perpendicular, both sides", () => {
  const prev = polar(LAST, 17 + 180, 60);
  near(
    angleOf(LAST, snapToAngle(polar(LAST, 105, 80), LAST, 0, 45, prev)),
    107,
    1e-9,
    "+90°"
  );
  near(
    angleOf(LAST, snapToAngle(polar(LAST, -70, 80), LAST, 0, 45, prev)),
    -73,
    1e-9,
    "-90°"
  );
});

test("last segment at 17°: going back along the segment", () => {
  const prev = polar(LAST, 17 + 180, 60);
  const snapped = snapToAngle(polar(LAST, -165, 80), LAST, 0, 45, prev);
  near(angleOf(LAST, snapped), -163, 1e-9, "180°");
});

test("last segment at 17°: the grid still wins when it is closer", () => {
  const prev = polar(LAST, 17 + 180, 60);
  near(
    angleOf(LAST, snapToAngle(polar(LAST, 44, 80), LAST, 0, 45, prev)),
    45,
    1e-9,
    "45°"
  );
  near(
    angleOf(LAST, snapToAngle(polar(LAST, 3, 80), LAST, 0, 45, prev)),
    0,
    1e-9,
    "0°"
  );
});

test("last segment on the grid: same result as without it", () => {
  const prev = { x: LAST.x - 60, y: LAST.y };
  for (const deg of [4, 41, 93, -130, 179]) {
    const cursor = polar(LAST, deg, 80);
    assert.deepEqual(
      snapToAngle(cursor, LAST, 0, 45, prev),
      snapToAngle(cursor, LAST)
    );
  }
});

test("degenerate last segment: falls back to the grid", () => {
  const cursor = polar(LAST, 20, 80);
  assert.deepEqual(
    snapToAngle(cursor, LAST, 0, 45, { ...LAST }),
    snapToAngle(cursor, LAST)
  );
});
