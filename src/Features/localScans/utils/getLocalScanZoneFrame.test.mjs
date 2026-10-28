import assert from "node:assert/strict";
import test from "node:test";
import { Group } from "three";
import applyPlacement from "./applyLocalScanPlacement.js";
import getFrame from "./getLocalScanSliceFrame.js";
import getZoneFrame from "./getLocalScanZoneFrame.js";
import { getScanZonePlacement } from "./localScanZone.js";

const bounds = { min: [-10, -6, 0], max: [14, 9, 3] };

test("an axis-aligned rectangle zone gives the zone extent", () => {
  const root = new Group();
  applyPlacement(root, { up: "Z", scale: 1, origin: [0, 0, 0], yaw: 0 });
  const zone = {
    up: "Z",
    rotationDeg: 0,
    polygon: [
      [-2, -1],
      [6, -1],
      [6, 3],
      [-2, 3],
    ],
  };
  const frame = getZoneFrame(zone, null, bounds, root.matrixWorld.elements, 0);
  const base = getFrame(bounds, root.matrixWorld.elements, 0);
  assert.deepEqual(frame.rows, base.rows);
  assert.deepEqual(frame.min.slice(0, 2), [-2, -3]);
  assert.deepEqual(frame.max.slice(0, 2), [6, 1]);
  assert.equal(frame.min[2], base.min[2]);
  assert.equal(frame.max[2], base.max[2]);
});

test("the whole scan keeps the bounds extent", () => {
  const root = new Group();
  applyPlacement(root, { up: "Z", scale: 2, origin: [1, 2, 0], yaw: 15 });
  const whole = [
    [-10, -6],
    [14, -6],
    [14, 9],
    [-10, 9],
  ];
  const zone = { up: "Z", rotationDeg: 0, polygon: null };
  const frame = getZoneFrame(
    zone,
    whole,
    bounds,
    root.matrixWorld.elements,
    15
  );
  const base = getFrame(bounds, root.matrixWorld.elements, 15);
  for (let axis = 0; axis < 2; axis++) {
    assert.ok(Math.abs(frame.min[axis] - base.min[axis]) < 1e-9);
    assert.ok(Math.abs(frame.max[axis] - base.max[axis]) < 1e-9);
  }
});

for (const up of ["Z", "Y"]) {
  test(`a rotated zone (up ${up}) is axis-aligned once placed`, () => {
    const rotationDeg = 30;
    const axesYaw = 12;
    // rectangle 8 × 4 rotated by 30° about (3, 2) in the horizontal frame
    const a = (rotationDeg * Math.PI) / 180;
    const corners = [
      [-4, -2],
      [4, -2],
      [4, 2],
      [-4, 2],
    ].map(([x, y]) => [
      3 + x * Math.cos(a) - y * Math.sin(a),
      2 + x * Math.sin(a) + y * Math.cos(a),
    ]);
    const zone = {
      up,
      rotationDeg,
      polygon: corners,
      baseZ: 0,
      recenter: true,
    };
    const placement = {
      scale: 1,
      ...getScanZonePlacement(zone, axesYaw, null),
    };
    const root = new Group();
    applyPlacement(root, placement);
    const b = up === "Y" ? { min: [-10, 0, -9], max: [14, 3, 6] } : bounds;
    const frame = getZoneFrame(
      zone,
      null,
      b,
      root.matrixWorld.elements,
      axesYaw
    );
    assert.ok(Math.abs(frame.max[0] - frame.min[0] - 8) < 1e-6);
    assert.ok(Math.abs(frame.max[1] - frame.min[1] - 4) < 1e-6);
    // recentred: the zone centre is scene zero
    assert.ok(Math.abs(frame.min[0] + 4) < 1e-6);
    assert.ok(Math.abs(frame.min[1] + 2) < 1e-6);
  });
}
