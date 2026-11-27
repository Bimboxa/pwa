import assert from "node:assert/strict";
import { test } from "node:test";

import getAlignMoveBatches from "./getAlignMoveBatches.js";

const polygon = (id, pointIds) => ({
  id,
  type: "POLYGON",
  points: pointIds.map((pointId) => ({ id: pointId, x: 0, y: 0 })),
});

test("independent annotations are written in a single batch", () => {
  const annotations = [
    polygon("a", ["a1", "a2"]),
    polygon("b", ["b1", "b2"]),
    { id: "r", type: "RECTANGLE", bbox: { x: 0, y: 0, width: 1, height: 1 } },
  ];
  const deltas = new Map([
    ["a", { x: 1, y: 0 }],
    ["b", { x: 2, y: 0 }],
    ["r", { x: 3, y: 0 }],
  ]);
  assert.deepEqual(getAlignMoveBatches({ annotations, deltas }), [
    ["a", "b", "r"],
  ]);
});

test("a point shared with different moves splits the batch", () => {
  const annotations = [
    polygon("a", ["a1", "shared"]),
    polygon("b", ["shared", "b1"]),
    polygon("c", ["c1"]),
  ];
  const deltas = new Map([
    ["a", { x: 1, y: 0 }],
    ["b", { x: 2, y: 0 }],
    ["c", { x: 5, y: 0 }],
  ]);
  assert.deepEqual(getAlignMoveBatches({ annotations, deltas }), [
    ["a", "c"],
    ["b"],
  ]);
});

test("a point shared with the same move stays in one batch", () => {
  const annotations = [
    polygon("a", ["a1", "shared"]),
    polygon("b", ["shared", "b1"]),
  ];
  const deltas = new Map([
    ["a", { x: 1, y: 0 }],
    ["b", { x: 1, y: 0 }],
  ]);
  assert.deepEqual(getAlignMoveBatches({ annotations, deltas }), [["a", "b"]]);
});

test("line refs keyed on pointId count as shared points", () => {
  const annotations = [
    polygon("a", ["a1"]),
    {
      id: "b",
      type: "POLYGON",
      points: [{ id: "b1", x: 0, y: 0 }],
      guideLines: [{ points: [{ pointId: "a1", x: 0, y: 0 }] }],
    },
  ];
  const deltas = new Map([
    ["a", { x: 1, y: 0 }],
    ["b", { x: 0, y: 4 }],
  ]);
  assert.deepEqual(getAlignMoveBatches({ annotations, deltas }), [
    ["a"],
    ["b"],
  ]);
});
