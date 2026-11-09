// Run: node src/Features/annotations/constants/shape3DConfig.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  asClosedSolidOperand,
  getShape3DOptionsForType,
  isOpenTopPrism,
} from "./shape3DConfig.js";

const pit = { type: "POLYGON", height: 1, shape3D: { key: "FOSSE" } };

test("« Fosse » is offered to a POLYGON with a height only", () => {
  const entry = getShape3DOptionsForType("POLYGON").find(
    (o) => o.key === "FOSSE"
  );
  assert.ok(entry);
  assert.equal(entry.isAvailable({ type: "POLYGON", height: 1 }), true);
  assert.equal(entry.isAvailable({ type: "POLYGON", height: 0 }), false);
  assert.equal(entry.isAvailable({ type: "POLYGON" }), false);
  const profileLines = [{ points: [{}, {}] }];
  assert.equal(
    entry.isAvailable({ type: "POLYGON", height: 1, profileLines }),
    false
  );
});

test("isOpenTopPrism", () => {
  assert.equal(isOpenTopPrism(pit), true);
  assert.equal(isOpenTopPrism({ ...pit, height: 0 }), false);
  assert.equal(isOpenTopPrism({ ...pit, shape3D: null }), false);
  assert.equal(isOpenTopPrism({ ...pit, type: "POLYLINE" }), false);
  assert.equal(isOpenTopPrism({ ...pit, isMesh3d: true }), false);
});

test("a « Fosse » operand is its closed prism", () => {
  assert.equal(asClosedSolidOperand(pit).shape3D, null);
  assert.equal(asClosedSolidOperand(pit).height, 1);
  const revolution = { type: "POLYLINE", shape3D: { key: "REVOLUTION" } };
  assert.equal(asClosedSolidOperand(revolution), revolution);
});
