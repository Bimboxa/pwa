import assert from "node:assert/strict";
import test from "node:test";
import classify from "./classifyScanPlaneNormal.js";

const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};

test("near-horizontal and near-vertical planes are snapped, oblique kept", () => {
  const floor = classify(unit([0.05, 0.99, -0.03]));
  assert.equal(floor.orientation, "HORIZONTAL");
  assert.deepEqual(floor.normal, [0, 1, 0]);
  assert.deepEqual(classify(unit([0.02, -1, 0])).normal, [0, -1, 0]);
  const wall = classify(unit([0.6, 0.08, -0.8]));
  assert.equal(wall.orientation, "VERTICAL");
  assert.equal(wall.normal[1], 0);
  assert.ok(Math.abs(Math.hypot(...wall.normal) - 1) < 1e-9);
  assert.ok(wall.normal[0] > 0 && wall.normal[2] < 0);
  const ramp = classify(unit([0, 0.7, 0.7]));
  assert.equal(ramp.orientation, null);
});
