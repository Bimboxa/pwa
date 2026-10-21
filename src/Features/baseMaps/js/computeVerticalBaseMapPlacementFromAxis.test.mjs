// Run with: npx vite-node src/Features/baseMaps/js/computeVerticalBaseMapPlacementFromAxis.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import baseMapLocalToWorld from "./baseMapLocalToWorld.js";
import computeVerticalBaseMapPlacementFromAxis from "./computeVerticalBaseMapPlacementFromAxis.js";
import getBaseMapTransform from "./getBaseMapTransform.js";

const EPS = 1e-6;

// A3 portrait page at 1:25, the "Fond de plan" coupe of an axis.
const ELEV_SIZE = { width: 1754, height: 2480 };
const ELEV_METER_BY_PX = 25 / ((150 / 25.4) * 1000);
const CLICK_NORM = { x: 0.5, y: 0.9 };

const PLAN_SIZE = { width: 2000, height: 1500 };
const PLAN_METER_BY_PX = 0.01;
const CENTER_NORM = { x: 0.3, y: 0.6 };

const makePlan = (position, angleDeg = 0) => ({
  orientation: "HORIZONTAL",
  angleDeg,
  position,
  image: { imageSize: PLAN_SIZE },
  meterByPx: PLAN_METER_BY_PX,
});

const makeElevation = () => ({
  orientation: "VERTICAL",
  image: { imageSize: ELEV_SIZE },
  meterByPx: ELEV_METER_BY_PX,
});

// World point of the elevation image spot `norm` once the solved pose is
// applied — what the 3D scene shows at the placement (the T base).
const worldOfElevationNorm = (norm, pose) => {
  const local = {
    x: (norm.x * ELEV_SIZE.width - ELEV_SIZE.width / 2) * ELEV_METER_BY_PX,
    y: -(norm.y * ELEV_SIZE.height - ELEV_SIZE.height / 2) * ELEV_METER_BY_PX,
  };
  return baseMapLocalToWorld(
    local,
    getBaseMapTransform({ orientation: "VERTICAL", ...pose })
  );
};

// World point of the axis centre on the plan, lifted by offsetZ — where the
// 3D renderer draws the base of the axis line (plan group, z = offsetZ).
const worldOfAxisBase = (plan, offsetZ) => {
  const local = {
    x:
      (CENTER_NORM.x * PLAN_SIZE.width - PLAN_SIZE.width / 2) *
      PLAN_METER_BY_PX,
    y:
      -(CENTER_NORM.y * PLAN_SIZE.height - PLAN_SIZE.height / 2) *
      PLAN_METER_BY_PX,
  };
  const c = baseMapLocalToWorld(local, getBaseMapTransform(plan));
  return { x: c.x, y: c.y + offsetZ, z: c.z };
};

const assertClose = (actual, expected, label) => {
  assert.ok(
    Math.abs(actual - expected) < EPS,
    `${label}: expected ${expected}, got ${actual}`
  );
};

const solveAndCheck = ({ plan, offsetZ, directionDeg = 0 }) => {
  const pose = computeVerticalBaseMapPlacementFromAxis({
    axis: { centerNorm: CENTER_NORM, directionDeg, invertHalf: false, offsetZ },
    planBaseMap: plan,
    elevationBaseMap: makeElevation(),
    clickNorm: CLICK_NORM,
  });
  assert.ok(pose, "solver returned a pose");
  const got = worldOfElevationNorm(CLICK_NORM, pose);
  const want = worldOfAxisBase(plan, offsetZ);
  assertClose(got.x, want.x, "x");
  assertClose(got.y, want.y, "y");
  assertClose(got.z, want.z, "z");
  return pose;
};

test("plan at Z = 0: the placement point lands on the axis base (regression)", () => {
  const pose = solveAndCheck({
    plan: makePlan({ x: 0, y: 0, z: 0 }),
    offsetZ: 0,
  });
  // Click at 90% of the height → the page centre is 0.4·H·m above the base.
  assertClose(
    pose.position.y,
    0.4 * ELEV_SIZE.height * ELEV_METER_BY_PX,
    "page centre"
  );
});

test("plan at Z = 4.2: the elevation follows the plan altitude", () => {
  const pose = solveAndCheck({
    plan: makePlan({ x: 3, y: 4.2, z: -2 }),
    offsetZ: 0,
  });
  assertClose(
    pose.position.y,
    4.2 + 0.4 * ELEV_SIZE.height * ELEV_METER_BY_PX,
    "page centre"
  );
});

test("plan at Z = 4.2 with axis offsetZ = 1.5: both lifts add up", () => {
  solveAndCheck({ plan: makePlan({ x: 3, y: 4.2, z: -2 }), offsetZ: 1.5 });
});

test("rotated plan at Z ≠ 0 with a turned diameter: still anchored on the axis base", () => {
  solveAndCheck({
    plan: makePlan({ x: -1, y: 2.5, z: 7 }, 37),
    offsetZ: 0.8,
    directionDeg: -161.24,
  });
});
