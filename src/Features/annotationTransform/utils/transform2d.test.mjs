import assert from "node:assert/strict";
import { test } from "node:test";

import { isTransformable3dType } from "../../threedAnnotationMove/utils/annotationTransformTypes.js";
import getFreeTextMoveUpdates from "./getFreeTextMoveUpdates.js";
import getObject3DTransformUpdates from "./getObject3DTransformUpdates.js";
import {
  isFreeTextType,
  isObject3DType,
  isPointHolderType,
  isTransformable2dType,
} from "./transform2dTypes.js";

const imageSize = { width: 200, height: 100 };

test("OBJECT_3D is moved and turned in 2D and 3D, never as a point holder", () => {
  for (const kind of ["MOVE", "ROTATE"]) {
    assert.ok(isTransformable2dType(kind, "OBJECT_3D"), kind);
    assert.ok(isTransformable3dType(kind, "OBJECT_3D"), kind);
    assert.ok(isTransformable3dType(kind, "POLYGON"), kind);
    assert.ok(!isTransformable3dType(kind, "COTE"), kind);
    assert.ok(!isTransformable3dType(kind, "IMAGE"), kind);
  }
  assert.ok(!isPointHolderType("OBJECT_3D"));
  assert.ok(isObject3DType("OBJECT_3D"));
  assert.ok(!isObject3DType("IMAGE"));
});

test("getObject3DTransformUpdates MOVE translates the bbox, adds deltaZ", () => {
  const updates = getObject3DTransformUpdates({
    annotations: [
      {
        id: "o",
        type: "OBJECT_3D",
        bbox: { x: 20, y: 10, width: 40, height: 20 },
        rotation: 30,
        offsetZ: 1,
      },
      { id: "w", type: "POLYLINE", points: [{ id: "p", x: 1, y: 1 }] },
    ],
    transform: { kind: "MOVE", deltaPx: { x: 20, y: -10 }, deltaZ: 0.5 },
    imageSize,
  });
  assert.equal(updates.size, 1);
  const { fields, affine } = updates.get("o");
  assert.deepEqual(fields, {
    bbox: { x: 0.2, y: 0, width: 0.2, height: 0.2 },
    offsetZ: 1.5,
  });
  assert.deepEqual(affine, { a: 1, b: 0, c: 20, d: 0, e: 1, f: -10 });
});

test("getObject3DTransformUpdates ROTATE orbits the bbox centre and turns the object", () => {
  const updates = getObject3DTransformUpdates({
    annotations: [
      {
        id: "o",
        type: "OBJECT_3D",
        bbox: { x: 90, y: 40, width: 20, height: 20 }, // centre (100, 50)
        rotation: 350,
      },
    ],
    // Pivot 50 px left of the centre, +90° (clockwise on screen): the
    // centre goes below the pivot.
    transform: { kind: "ROTATE", pivotPx: { x: 50, y: 50 }, angleDeg: 90 },
    imageSize,
  });
  const { fields } = updates.get("o");
  assert.ok(Math.abs(fields.bbox.x * 200 - 40) < 1e-9);
  assert.ok(Math.abs(fields.bbox.y * 100 - 90) < 1e-9);
  assert.equal(fields.rotation, 80);
  assert.equal(fields.offsetZ, undefined);
});

test("getObject3DTransformUpdates is empty without a usable transform or image size", () => {
  const ann = {
    id: "o",
    type: "OBJECT_3D",
    bbox: { x: 0, y: 0, width: 1, height: 1 },
  };
  assert.equal(
    getObject3DTransformUpdates({
      annotations: [ann],
      transform: { kind: "MOVE", deltaPx: { x: 1, y: 1 } },
    }).size,
    0
  );
  assert.equal(
    getObject3DTransformUpdates({
      annotations: [ann],
      transform: { kind: "ROTATE", pivotPx: null, angleDeg: 10 },
      imageSize,
    }).size,
    0
  );
});

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
