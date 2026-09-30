import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyAffineToMesh3dSource,
  buildMesh3dResetPatch,
  buildMesh3dSource,
  getMesh3dSourcePoints,
} from "./mesh3dSource.js";

// A thick wall (POLYLINE) about to be converted.
const wall = {
  id: "wall",
  type: "POLYLINE",
  height: 2.5,
  offsetZ: 0.4,
  strokeColor: "#aa3333",
  strokeWidth: 20,
  points: [
    { id: "a", type: "square" },
    { id: "b", type: "circle", offsetTop: 0.2 },
    { id: "c" },
  ],
  hiddenSegmentsPointIds: ["b"],
};
const pointsById = new Map([
  ["a", { x: 0.1, y: 0.2 }],
  ["b", { x: 0.5, y: 0.2 }],
  ["c", { x: 0.5, y: 0.6 }],
]);
// What writeMesh3dService writes at conversion.
const patch = {
  type: "POLYGON",
  isMesh3d: true,
  mesh3d: { vertices: [], faces: [] },
  height: 0,
  offsetZ: 0.4,
  points: [{ id: "p1" }],
  cuts: [],
  hiddenSegmentsPointIds: [],
  fillColor: "#aa3333",
};

test("the snapshot keeps the overwritten fields and the points inline", () => {
  const source = buildMesh3dSource({ annotation: wall, patch, pointsById });
  assert.deepEqual(source.fields, {
    type: "POLYLINE",
    height: 2.5,
    offsetZ: 0.4,
    hiddenSegmentsPointIds: ["b"],
  });
  // fillColor did not exist on the row: the conversion added it.
  assert.deepEqual(source.unsetKeys, ["fillColor"]);
  assert.deepEqual(source.points[1], {
    id: "b",
    type: "circle",
    offsetTop: 0.2,
    x: 0.5,
    y: 0.2,
  });
  assert.equal(source.cuts, null);
  assert.equal(getMesh3dSourcePoints(source).length, 3);
});

test("the reset patch restores the row and drops the mesh", () => {
  const source = buildMesh3dSource({ annotation: wall, patch, pointsById });
  // "b" moved away since: it is restored on a new row.
  const reset = buildMesh3dResetPatch(source, new Map([["b", "b2"]]));
  assert.equal(reset.type, "POLYLINE");
  assert.equal(reset.height, 2.5);
  assert.deepEqual(reset.points, [
    { id: "a", type: "square" },
    { id: "b2", type: "circle", offsetTop: 0.2 },
    { id: "c" },
  ]);
  assert.deepEqual(reset.hiddenSegmentsPointIds, ["b2"]);
  // Deleted from the row (undefined = delete in a Dexie update).
  for (const key of [
    "isMesh3d",
    "mesh3d",
    "mesh3dSource",
    "fillColor",
    "cuts",
  ]) {
    assert.ok(key in reset);
    assert.equal(reset[key], undefined);
  }
});

test("holes are snapshotted and restored with their own points", () => {
  const slab = {
    type: "POLYGON",
    height: 0.2,
    points: [{ id: "a" }, { id: "b" }, { id: "c" }],
    cuts: [{ id: "cut", points: [{ id: "h1" }, { id: "h2" }, { id: "h3" }] }],
  };
  const rows = new Map(
    ["a", "b", "c", "h1", "h2", "h3"].map((id, i) => [id, { x: i / 10, y: 0 }])
  );
  const source = buildMesh3dSource({
    annotation: slab,
    patch: { type: "POLYGON", height: 0, points: [], cuts: [] },
    pointsById: rows,
  });
  assert.equal(getMesh3dSourcePoints(source).length, 6);
  const reset = buildMesh3dResetPatch(source, new Map([["h2", "n"]]));
  assert.deepEqual(reset.cuts, [
    { id: "cut", points: [{ id: "h1" }, { id: "n" }, { id: "h3" }] },
  ]);
});

test("the snapshot follows the affine map applied to the mesh", () => {
  const source = buildMesh3dSource({ annotation: wall, patch, pointsById });
  const moved = applyAffineToMesh3dSource(
    source,
    { a: 1, b: 0, c: 100, d: 0, e: 1, f: -50 },
    { width: 1000, height: 500 }
  );
  assert.ok(Math.abs(moved.points[0].x - 0.2) < 1e-12);
  assert.ok(Math.abs(moved.points[0].y - 0.1) < 1e-12);
  // ref props untouched
  assert.equal(moved.points[1].type, "circle");
  assert.equal(moved.fields.type, "POLYLINE");
});
