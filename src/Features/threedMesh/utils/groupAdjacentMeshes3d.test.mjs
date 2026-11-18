import assert from "node:assert/strict";
import { test } from "node:test";

import groupAdjacentMeshes3d from "./groupAdjacentMeshes3d.js";
import mergeMesh3dGeometries from "./mergeMesh3dGeometries.js";

// World is Y-up: the floor lies in the plane y = 0.
const UP = { x: 0, y: 1, z: 0 };

// Floor rectangle [x0, x1] × [z0, z1] at y = 0.
const floor = (id, x0, z0, x1, z1) => ({
  id,
  faces: [
    {
      contour: [
        { x: x0, y: 0, z: z0 },
        { x: x1, y: 0, z: z0 },
        { x: x1, y: 0, z: z1 },
        { x: x0, y: 0, z: z1 },
      ],
      holes: [],
      normal: UP,
    },
  ],
});

// Vertical rectangle in the plane x = x0, z in [z0, z1], y in [y0, y1].
const wallX = (id, x0, z0, z1, y0 = 0, y1 = 2) => ({
  id,
  faces: [
    {
      contour: [
        { x: x0, y: y0, z: z0 },
        { x: x0, y: y0, z: z1 },
        { x: x0, y: y1, z: z1 },
        { x: x0, y: y1, z: z0 },
      ],
      holes: [],
      normal: { x: 1, y: 0, z: 0 },
    },
  ],
});

const ids = (groups) =>
  groups.map((group) => group.map((row) => row.id).sort()).sort();

test("two pieces of a floor split by a cut line stay apart", () => {
  const rows = [floor("a", 0, -5, 10, 0), floor("b", 0, 0, 10, 5)];
  const line = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [line])), []);
});

test("two touching floors without a cut line merge", () => {
  const rows = [floor("a", 0, -5, 10, 0), floor("b", 0, 0, 10, 5)];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [])), [["a", "b"]]);
});

test("a cut line covering part of the shared border does not separate", () => {
  const rows = [floor("a", 0, -5, 10, 0), floor("b", 0, 0, 10, 5)];
  const line = [
    { x: 0, y: 0, z: 0 },
    { x: 6, y: 0, z: 0 },
  ];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [line])), [["a", "b"]]);
});

test("disjoint mailles and corner contacts do not merge", () => {
  const rows = [
    floor("a", 0, 0, 1, 1),
    floor("far", 5, 5, 6, 6),
    floor("corner", 1, 1, 2, 2),
  ];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [])), []);
});

test("a wall shrunk 15 mm off the floor edge merges with it", () => {
  const rows = [floor("f", 0, -5, 10, 5), wallX("w", -0.01, -5, 5, 0.005)];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [])), [["f", "w"]]);
});

test("a line climbing a wall splits floor and wall into two sides", () => {
  // The line runs on the floor along x (z = 0), then climbs the wall
  // standing on the floor edge x = 0.
  const line = [
    { x: 10, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 },
  ];
  const rows = [
    floor("f-", 0, -5, 10, 0),
    floor("f+", 0, 0, 10, 5),
    wallX("w-", 0, -5, 0),
    wallX("w+", 0, 0, 5),
  ];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [line])), [
    ["f+", "w+"],
    ["f-", "w-"],
  ]);
});

test("the prolongation of a line under a box keeps the floor sides apart", () => {
  // The line reaches the box side at x = 4, climbs it, crosses the top and
  // comes back to the floor at x = 6: the floor is cut under the box too.
  const line = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 1, z: 0 },
    { x: 6, y: 1, z: 0 },
    { x: 6, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  const rows = [
    floor("f-", 0, -5, 10, 0),
    floor("f+", 0, 0, 10, 5),
    // Box side faces (plane x = 4), standing INSIDE the floor.
    wallX("s-", 4, -3, 0, 0, 1),
    wallX("s+", 4, 0, 3, 0, 1),
  ];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [line])), [
    ["f+", "s+"],
    ["f-", "s-"],
  ]);
});

test("a shell maille merges by its borders", () => {
  const shell = {
    id: "s",
    faces: [],
    shell: {
      positions: [0, 0, 0, 0, 1, -1, 10, 0, 0, 10, 0, 0, 0, 1, -1, 10, 1, -1],
      boundaries: [
        [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 1, z: -1 },
          { x: 0, y: 1, z: -1 },
        ],
      ],
      surface: 10 * Math.SQRT2,
    },
  };
  const rows = [floor("f", 0, 0, 10, 5), shell];
  assert.deepEqual(ids(groupAdjacentMeshes3d(rows, [])), [["f", "s"]]);

  const merged = mergeMesh3dGeometries(rows);
  assert.equal(merged.faces.length, 0);
  assert.equal(merged.shell.positions.length / 9, 4);
  assert.ok(Math.abs(merged.surface - (50 + 10 * Math.SQRT2)) < 1e-6);
  // The loops of both mailles are kept.
  assert.equal(merged.shell.boundaries.length, 2);
});

test("planar mailles merge into unioned coplanar faces", () => {
  const merged = mergeMesh3dGeometries([
    floor("a", 0, -5, 10, 0),
    floor("b", 0, 0, 10, 5),
    wallX("w", 0, -5, 5),
  ]);
  assert.equal(merged.shell, null);
  assert.equal(merged.faces.length, 2);
  assert.ok(Math.abs(merged.surface - 120) < 1e-6);
});
