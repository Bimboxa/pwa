import assert from "node:assert/strict";
import { test } from "node:test";

import getFreeTextMoveUpdates from "./getFreeTextMoveUpdates.js";
import {
  isFreeTextType,
  isPointHolderType,
  isTransformable2dType,
} from "./transform2dTypes.js";

const imageSize = { width: 200, height: 100 };

test("MOVE accepts point tracings, COTE / RULER and FREE_TEXT; ROTATE refuses FREE_TEXT", () => {
  for (const type of ["POLYLINE", "POLYGON", "STRIP", "LINEAR_LAYOUT"]) {
    assert.ok(isTransformable2dType("MOVE", type), type);
    assert.ok(isTransformable2dType("ROTATE", type), type);
  }
  for (const type of ["COTE", "RULER"]) {
    assert.ok(isTransformable2dType("MOVE", type), type);
    assert.ok(isTransformable2dType("ROTATE", type), type);
    assert.ok(isPointHolderType(type), type);
  }
  assert.ok(isTransformable2dType("MOVE", "FREE_TEXT"));
  assert.ok(!isTransformable2dType("ROTATE", "FREE_TEXT"));
  assert.ok(!isPointHolderType("FREE_TEXT"));
  assert.ok(isFreeTextType("FREE_TEXT"));
  for (const type of ["LABEL", "IMAGE", "RECTANGLE", "POINT", "MARKER"]) {
    assert.ok(!isTransformable2dType("MOVE", type), type);
    assert.ok(!isTransformable2dType("ROTATE", type), type);
  }
});

test("getFreeTextMoveUpdates translates and normalizes targetPoint / labelPoint", () => {
  const updates = getFreeTextMoveUpdates({
    annotations: [
      {
        id: "t",
        type: "FREE_TEXT",
        targetPoint: { x: 20, y: 10 },
        labelPoint: { x: 60, y: 30 },
      },
      { id: "w", type: "POLYLINE", points: [{ id: "p", x: 1, y: 1 }] },
    ],
    deltaPx: { x: 20, y: -10 },
    imageSize,
  });
  assert.equal(updates.size, 1);
  assert.deepEqual(updates.get("t"), {
    targetPoint: { x: 0.2, y: 0 },
    labelPoint: { x: 0.4, y: 0.2 },
  });
});

test("getFreeTextMoveUpdates carries an elbow and tolerates a missing point", () => {
  const updates = getFreeTextMoveUpdates({
    annotations: [
      {
        id: "t",
        type: "FREE_TEXT",
        targetPoint: { x: 20, y: 10 },
        labelPoint: { x: 60, y: 30 },
        elbowPoint: { x: 40, y: 20 },
      },
      { id: "u", type: "FREE_TEXT", labelPoint: { x: 100, y: 50 } },
    ],
    deltaPx: { x: 0, y: 0 },
    imageSize,
  });
  assert.deepEqual(updates.get("t").elbowPoint, { x: 0.2, y: 0.2 });
  assert.deepEqual(updates.get("u"), {
    targetPoint: { x: 0.5, y: 0.5 },
    labelPoint: { x: 0.5, y: 0.5 },
  });
});

test("getFreeTextMoveUpdates is empty without a usable image size or delta", () => {
  const ann = {
    id: "t",
    type: "FREE_TEXT",
    targetPoint: { x: 1, y: 1 },
    labelPoint: { x: 1, y: 1 },
  };
  assert.equal(
    getFreeTextMoveUpdates({ annotations: [ann], deltaPx: { x: 1, y: 1 } })
      .size,
    0
  );
  assert.equal(
    getFreeTextMoveUpdates({ annotations: [ann], deltaPx: null, imageSize })
      .size,
    0
  );
});
