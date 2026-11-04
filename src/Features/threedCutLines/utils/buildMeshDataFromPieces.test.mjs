import assert from "node:assert/strict";
import { test } from "node:test";

import buildMeshDataFromPieces from "./buildMeshDataFromPieces.js";
import computeFaceArea from "../../threedMesh/utils/computeFaceArea.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );

const v = (x, y, z) => ({ x, y, z });

test("one piece keeps the planar face model", () => {
  const piece = {
    contour: [v(0, 0, 0), v(2, 0, 0), v(2, 1, 0), v(0, 1, 0)],
    holes: [],
    normal: v(0, 0, 1),
  };
  const data = buildMeshDataFromPieces([piece]);
  assert.ok(data?.faces);
  assert.equal(data.faces.length, 1);
  near(computeFaceArea(data.faces[0]), 2);
});

test("two coplanar halves coalesce into one face", () => {
  const left = {
    contour: [v(0, 0, 0), v(2, 0, 0), v(2, 4, 0), v(0, 4, 0)],
    holes: [],
    normal: v(0, 0, 1),
  };
  const right = {
    contour: [v(2, 0, 0), v(4, 0, 0), v(4, 4, 0), v(2, 4, 0)],
    holes: [],
    normal: v(0, 0, 1),
  };
  const data = buildMeshDataFromPieces([left, right]);
  assert.ok(data?.faces);
  assert.equal(data.faces.length, 1);
  near(computeFaceArea(data.faces[0]), 16);
  assert.equal(data.shell, undefined);
});

test("two folded pieces with a T-junction become one shell", () => {
  // Vertical quad in the XY plane (normal +z), then a quad folded 90° in
  // the YZ plane sharing the edge x=1. The folded quad carries an extra
  // vertex at the middle of the shared edge (T-junction).
  const front = {
    contour: [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)],
    holes: [],
    normal: v(0, 0, 1),
  };
  const side = {
    contour: [v(1, 0, 0), v(1, 0, -1), v(1, 1, -1), v(1, 1, 0), v(1, 0.5, 0)],
    holes: [],
    normal: v(1, 0, 0),
  };
  const data = buildMeshDataFromPieces([front, side]);
  assert.ok(data?.shell);
  assert.equal(data.faces, undefined);
  near(data.shell.surface, 2);
  // One outer boundary loop: the shared edge is interior.
  assert.equal(data.shell.boundaries.length, 1);
  assert.equal(data.shell.positions.length % 9, 0);
});
