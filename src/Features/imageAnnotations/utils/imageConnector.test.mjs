import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getImageCardLift,
  getImageAnchorPoint,
  getImageConnectorGeometry,
  getImageCardMoveUpdates,
  getImagePinnedBbox,
  getImageEffectiveBbox,
  isImageDetached,
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

test("a pinned photo has its visual top-left corner on the anchor", () => {
  const annotation = {
    bbox: { x: 100, y: 100, width: 200, height: 100 },
    targetPoint: { x: 500, y: 150 },
  };
  assert.equal(isImageDetached(annotation), false);
  assert.deepEqual(getImageEffectiveBbox(annotation), {
    x: 500,
    y: 150,
    width: 200,
    height: 100,
  });
  // Legacy row without anchor: pinned on its former centre.
  const legacy = getImageEffectiveBbox({ bbox: annotation.bbox });
  assert.deepEqual([legacy.x, legacy.y], [200, 150]);
  // Rotated 90°: the drawn photo is 100 x 200, its top-left on the anchor.
  const turned = getImagePinnedBbox({ ...annotation, rotation: 90 });
  const cx = turned.x + 100,
    cy = turned.y + 50;
  assert.ok(Math.abs(cx - 50 - 500) < 1e-9 && Math.abs(cy - 100 - 150) < 1e-9);
  // Normalized row: same result once scaled by the image size.
  const size = { width: 2000, height: 1000 };
  const normalized = getImagePinnedBbox(
    {
      bbox: { x: 0.05, y: 0.1, width: 0.1, height: 0.1 },
      targetPoint: { x: 0.25, y: 0.15 },
      rotation: 90,
    },
    size
  );
  assert.ok(Math.abs(normalized.x * 2000 - turned.x) < 1e-9);
  assert.ok(Math.abs(normalized.y * 1000 - turned.y) < 1e-9);
  // Detached photos and « Objet 2D » symbols keep their stored bbox.
  for (const flag of [{ hasConnector: true }, { isObject2D: true }])
    assert.equal(
      getImageEffectiveBbox({ ...annotation, ...flag }),
      annotation.bbox
    );
});

test("3D movement of a pinned photo moves its anchor with it", () => {
  const annotation = {
    bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.4 },
    targetPoint: { x: 0.1, y: 0.2 },
  };
  const moved = getImageCardMoveUpdates(
    annotation,
    { x: 2, y: -1, z: 0.5 },
    { width: 2000, height: 1000 },
    0.01
  );
  assert.ok(Math.abs(moved.targetPoint.x - 0.2) < 1e-12);
  assert.ok(Math.abs(moved.targetPoint.y - 0.3) < 1e-12);
  assert.ok(Math.abs(moved.bbox.x - 0.2) < 1e-12);
  assert.ok(Math.abs(moved.bbox.y - 0.3) < 1e-12);
  assert.equal(moved.imageLift3d, 1.5);
});

test("3D movement of a detached photo persists normalized XY and height without moving the attachment", () => {
  const annotation = {
    bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.4 },
    hasConnector: true,
  };
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
