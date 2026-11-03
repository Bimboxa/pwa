import assert from "node:assert/strict";
import { test } from "node:test";

import projectAxisDirInPlane from "./projectAxisDirInPlane.js";

const v = (x, y, z) => ({ x, y, z });
const near = (vec, [x, y, z], eps = 1e-9) => {
  assert.ok(
    Math.abs(vec.x - x) <= eps &&
      Math.abs(vec.y - y) <= eps &&
      Math.abs(vec.z - z) <= eps,
    `expected (${x}, ${y}, ${z}), got (${vec.x}, ${vec.y}, ${vec.z})`
  );
};

test("an axis lying in the plane is unchanged (Z on a vertical wall)", () => {
  const dir = projectAxisDirInPlane(v(0, 1, 0), v(1, 0, 0));
  near(dir, [0, 1, 0]);
});

test("an oblique axis is projected and normalized (Z on a sloped roof)", () => {
  // Roof plane tilted 45° around world X: normal (0, 1, 1) / √2.
  const s = Math.SQRT1_2;
  const dir = projectAxisDirInPlane(v(0, 1, 0), v(0, s, s));
  near(dir, [0, s, -s]);
  near({ x: dir.length(), y: 0, z: 0 }, [1, 0, 0]);
});

test("an axis perpendicular to the plane has no in-plane direction", () => {
  assert.equal(projectAxisDirInPlane(v(0, 1, 0), v(0, 1, 0)), null);
  assert.equal(projectAxisDirInPlane(v(0, 1, 0), v(0, -1, 0)), null);
});

test("without a normal the axis is returned as is (unit)", () => {
  near(projectAxisDirInPlane(v(2, 0, 0), null), [1, 0, 0]);
  near(projectAxisDirInPlane(v(0, 0, 3), v(0, 0, 0)), [0, 0, 1]);
});

test("a missing or null axis yields null", () => {
  assert.equal(projectAxisDirInPlane(null, v(0, 1, 0)), null);
  assert.equal(projectAxisDirInPlane(v(0, 0, 0), v(0, 1, 0)), null);
});
