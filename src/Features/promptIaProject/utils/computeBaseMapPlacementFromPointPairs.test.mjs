import { test } from "node:test";
import assert from "node:assert/strict";

import computeBaseMapPlacementFromPointPairs from "./computeBaseMapPlacementFromPointPairs.js";

const PLAN_SIZE = { width: 4000, height: 3000 };
const PLAN_M = 0.02;
const REF_SIZE = { width: 2048, height: 2048 };
const REF_M = 0.15;

// Same maths as baseMapNormalizedToWorld for a HORIZONTAL base map: local
// metres centred on the image, then the rotation around world +Y.
function planPxToWorld(p, { position, angleDeg, meterByPx }) {
  const x = (p.x - PLAN_SIZE.width / 2) * meterByPx;
  const z = (p.y - PLAN_SIZE.height / 2) * meterByPx;
  const phi = (angleDeg * Math.PI) / 180;
  return {
    x: x * Math.cos(phi) + z * Math.sin(phi) + position.x,
    z: -x * Math.sin(phi) + z * Math.cos(phi) + position.z,
  };
}

const worldToRefPx = (w) => ({
  x: w.x / REF_M + REF_SIZE.width / 2,
  y: w.z / REF_M + REF_SIZE.height / 2,
});

const PLAN_POINTS = [
  { x: 500, y: 400 },
  { x: 3600, y: 500 },
  { x: 3400, y: 2700 },
  { x: 700, y: 2500 },
];

function pairsFor(placement, points = PLAN_POINTS) {
  return points.map((plan) => ({
    plan,
    reference: worldToRefPx(planPxToWorld(plan, placement)),
  }));
}

const solve = (pairs, overrides = {}) =>
  computeBaseMapPlacementFromPointPairs({
    pairs,
    planSize: PLAN_SIZE,
    planMeterByPx: PLAN_M,
    referenceSize: REF_SIZE,
    referenceMeterByPx: REF_M,
    ...overrides,
  });

const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`
  );

test("recovers a pure translation", () => {
  const truth = {
    position: { x: 12, z: -30 },
    angleDeg: 0,
    meterByPx: PLAN_M,
  };
  const result = solve(pairsFor(truth));
  close(result.position.x, 12);
  close(result.position.z, -30);
  close(result.angleDeg, 0);
  close(result.rmsMeters, 0);
  close(result.scaleRatio, 1);
});

test("recovers the rotation around the vertical axis", () => {
  for (const angleDeg of [90, -37.5, 170]) {
    const truth = { position: { x: -8, z: 21 }, angleDeg, meterByPx: PLAN_M };
    const result = solve(pairsFor(truth), { altitude: 3.2 });
    close(result.angleDeg, angleDeg);
    close(result.position.x, -8);
    close(result.position.z, 21);
    assert.equal(result.position.y, 3.2);
    // every plan point lands on its reference point
    for (const plan of PLAN_POINTS) {
      const expected = planPxToWorld(plan, truth);
      const actual = planPxToWorld(plan, result);
      close(actual.x, expected.x);
      close(actual.z, expected.z);
    }
  }
});

test("works with two points only", () => {
  const truth = { position: { x: 5, z: 5 }, angleDeg: 25, meterByPx: PLAN_M };
  const result = solve(pairsFor(truth, PLAN_POINTS.slice(0, 2)));
  close(result.angleDeg, 25);
  close(result.position.x, 5);
});

test("keeps the drawing scale and reports the disagreement", () => {
  // points picked on a plan that is really 10 % larger than its scale says
  const truth = {
    position: { x: 0, z: 0 },
    angleDeg: 10,
    meterByPx: PLAN_M * 1.1,
  };
  const result = solve(pairsFor(truth));
  assert.equal(result.meterByPx, PLAN_M);
  close(result.scaleRatio, 1.1);
  close(result.angleDeg, 10);
  assert.ok(result.rmsMeters > 1);
});

test("fits the scale of a plan without one", () => {
  const truth = { position: { x: 3, z: -4 }, angleDeg: -60, meterByPx: 0.05 };
  const result = solve(pairsFor(truth), { planMeterByPx: null });
  close(result.meterByPx, 0.05);
  close(result.angleDeg, -60);
  close(result.rmsMeters, 0);
});

test("averages noisy points", () => {
  const truth = { position: { x: 40, z: 15 }, angleDeg: 33, meterByPx: PLAN_M };
  const noise = [3, -2, 1, -3];
  const pairs = pairsFor(truth).map((pair, i) => ({
    plan: pair.plan,
    reference: {
      x: pair.reference.x + noise[i],
      y: pair.reference.y - noise[i],
    },
  }));
  const result = solve(pairs);
  close(result.angleDeg, 33, 1);
  close(result.position.x, 40, 0.5);
  assert.ok(result.rmsMeters > 0 && result.rmsMeters < 1);
});

test("refuses pairs that cannot define a placement", () => {
  const same = { plan: { x: 10, y: 10 }, reference: { x: 5, y: 5 } };
  assert.equal(solve([same, same]), null);
  assert.equal(solve([same]), null);
  assert.equal(
    solve(
      pairsFor({ position: { x: 0, z: 0 }, angleDeg: 0, meterByPx: PLAN_M }),
      { referenceMeterByPx: null }
    ),
    null
  );
});
