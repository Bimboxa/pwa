import assert from "node:assert/strict";
import { test } from "node:test";

import getTransformPointUpdates from "./getTransformPointUpdates.js";
import {
  appendToAngleBuffer,
  formatUserAngle,
  getRotatePixelAngleDeg,
  parseAngleBufferToPixelDeg,
} from "./rotateAngle.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

const wall = {
  id: "a",
  type: "POLYLINE",
  points: [
    { id: "p1", x: 10, y: 10 },
    { id: "p2", x: 20, y: 10 },
  ],
  cuts: [{ points: [{ id: "c1", x: 12, y: 10 }] }],
  guideLines: [{ points: [{ pointId: "g1", x: 15, y: 10 }] }],
};

test("MOVE translates every point holder of the carried annotations", () => {
  const updates = getTransformPointUpdates({
    annotations: [wall],
    transform: { kind: "MOVE", deltaPx: { x: 5, y: -2 } },
  });
  assert.deepEqual(updates.get("p1"), { x: 15, y: 8 });
  assert.deepEqual(updates.get("p2"), { x: 25, y: 8 });
  assert.deepEqual(updates.get("c1"), { x: 17, y: 8 });
  assert.deepEqual(updates.get("g1"), { x: 20, y: 8 });
});

test("ROTATE turns around the picked pivot, which stays in place", () => {
  const updates = getTransformPointUpdates({
    annotations: [wall],
    transform: { kind: "ROTATE", pivotPx: { x: 10, y: 10 }, angleDeg: 90 },
  });
  near(updates.get("p1").x, 10);
  near(updates.get("p1").y, 10);
  // +90° in pixel space (y down): +x turns to +y.
  near(updates.get("p2").x, 10);
  near(updates.get("p2").y, 20);
});

test("unknown transform: nothing to write", () => {
  assert.equal(
    getTransformPointUpdates({ annotations: [wall], transform: null }).size,
    0
  );
});

test("mouse angle is measured from the reference direction", () => {
  const pivot = { x: 0, y: 0 };
  const reference = { x: 10, y: 0 };
  near(
    getRotatePixelAngleDeg({ pivot, reference, cursor: { x: 0, y: 5 } }),
    90
  );
  near(
    getRotatePixelAngleDeg({ pivot, reference, cursor: { x: 0, y: -5 } }),
    -90
  );
  // Shift: 15° steps.
  near(
    getRotatePixelAngleDeg({
      pivot,
      reference,
      cursor: { x: 10, y: 3 },
      stepDeg: 15,
    }),
    15
  );
  assert.equal(
    getRotatePixelAngleDeg({ pivot, reference, cursor: { x: 0, y: 0 } }),
    null
  );
});

test("typed angle is counter-clockwise positive", () => {
  assert.equal(parseAngleBufferToPixelDeg("45"), -45);
  assert.equal(parseAngleBufferToPixelDeg("-12,5"), 12.5);
  assert.equal(parseAngleBufferToPixelDeg(""), null);
  assert.equal(parseAngleBufferToPixelDeg("-"), null);
  assert.equal(formatUserAngle(-45), "45°");
  assert.equal(formatUserAngle(0), "0°");
});

test("angle buffer accepts a leading minus only", () => {
  assert.equal(appendToAngleBuffer("", "-"), "-");
  assert.equal(appendToAngleBuffer("1", "-"), "1");
  assert.equal(appendToAngleBuffer("1", "2"), "12");
  assert.equal(appendToAngleBuffer("1", "a"), "1");
});
