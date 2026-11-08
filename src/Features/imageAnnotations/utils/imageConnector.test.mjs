import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getImageCardLift,
  getImageAnchorPoint,
  getImageConnectorGeometry,
  getImageCardMoveUpdates,
} from "./imageConnector.js";

test("horizontal photos start on the plan and retain an explicitly moved height", () => {
  assert.equal(getImageCardLift({}), 1);
  assert.equal(getImageCardLift({ imageOrientation3d: "HORIZONTAL" }), 0);
  assert.equal(
    getImageCardLift({ imageOrientation3d: "HORIZONTAL", imageLift3d: 1.4 }),
    1.4
  );
});

test("leader clips at the rotated photo border", () => {
  const annotation = {
    bbox: { x: 100, y: 100, width: 200, height: 100 },
    targetPoint: { x: 500, y: 150 },
  };
  assert.deepEqual(getImageConnectorGeometry(annotation).end, {
    x: 300,
    y: 150,
  });
  assert.deepEqual(
    getImageConnectorGeometry({ ...annotation, rotation: 90 }).end,
    { x: 250, y: 150 }
  );
  assert.equal(
    getImageConnectorGeometry({
      ...annotation,
      targetPoint: { x: 200, y: 150 },
    }).inside,
    true
  );
});

test("3D movement persists normalized XY and height without moving the attachment", () => {
  const annotation = { bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.4 } };
  const size = { width: 2000, height: 1000 };
  const moved = getImageCardMoveUpdates(
    annotation,
    { x: 2, y: -1, z: 0.5 },
    size,
    0.01
  );
  assert.equal(moved.bbox.x, 0.2);
  assert.ok(Math.abs(moved.bbox.y - 0.3) < 1e-12);
  assert.equal(moved.bbox.width, annotation.bbox.width);
  assert.equal(moved.bbox.height, annotation.bbox.height);
  assert.deepEqual(moved.targetPoint, { x: 0.2, y: 0.4 });
  assert.equal(moved.imageLift3d, 1.5);
  assert.deepEqual(
    getImageAnchorPoint({ ...annotation, ...moved }),
    moved.targetPoint
  );
  const target = getImageCardMoveUpdates(
    { ...annotation, ...moved },
    { x: 1, y: 1, z: 5 },
    size,
    0.01,
    true
  );
  assert.deepEqual(Object.keys(target), ["targetPoint"]);
  assert.equal(target.targetPoint.x, 0.25);
  assert.ok(Math.abs(target.targetPoint.y - 0.3) < 1e-12);
  assert.equal(
    getImageCardMoveUpdates(annotation, { x: 1, y: 1, z: 0 }, {}, 0.01),
    null
  );
});
