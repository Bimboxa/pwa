// Run: node src/Features/annotations/constants/shape3DConfig.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  asClosedSolidOperand,
  getShape3DOptionsForType,
  isInvertedUWall,
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

const invertedU = {
  type: "POLYLINE",
  height: 0.2,
  strokeWidth: 20,
  strokeWidthUnit: "CM",
  shape3D: { key: "INVERTED_U" },
};

test("« U inversé » is offered to a CM-width POLYLINE / STRIP with a height", () => {
  for (const type of ["POLYLINE", "STRIP"]) {
    const entry = getShape3DOptionsForType(type).find(
      (o) => o.key === "INVERTED_U"
    );
    assert.ok(entry);
    assert.equal(entry.isAvailable({ ...invertedU, type }), true);
    assert.equal(entry.isAvailable({ ...invertedU, type, height: 0 }), false);
    assert.equal(
      entry.isAvailable({ ...invertedU, type, strokeWidthUnit: "PX" }),
      false
    );
  }
});

test("isInvertedUWall", () => {
  assert.equal(isInvertedUWall(invertedU), true);
  assert.equal(isInvertedUWall({ ...invertedU, type: "STRIP" }), true);
  assert.equal(isInvertedUWall({ ...invertedU, shape3D: null }), false);
  assert.equal(isInvertedUWall({ ...invertedU, height: 0 }), false);
  assert.equal(isInvertedUWall({ ...invertedU, type: "POLYGON" }), false);
  // a STRIP with openings keeps its footprint build
  const cuts = [{ points: [{}, {}, {}] }];
  assert.equal(isInvertedUWall({ ...invertedU, type: "STRIP", cuts }), false);
});

test("a « U inversé » operand is the closed wall", () => {
  assert.equal(asClosedSolidOperand(invertedU).shape3D, null);
});
