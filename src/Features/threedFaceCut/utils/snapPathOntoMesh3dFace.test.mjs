import assert from "node:assert/strict";
import { test } from "node:test";

import { splitMesh3dFaceDetailed } from "../../annotationMesh3d/utils/splitMesh3dFace.js";

import snapPathOntoMesh3dFace from "./snapPathOntoMesh3dFace.js";

const v = (x, y, z) => ({ x, y, z });
const near = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`
  );
const nearV = (actual, expected, eps = 1e-9) => {
  near(actual.x, expected.x, eps);
  near(actual.y, expected.y, eps);
  near(actual.z, expected.z, eps);
};

// Wall [0,2]×[0,0.2]×[0,1] (un-shrunk mesh), faces CCW seen from outside.
function makeWall() {
  return {
    vertices: [
      v(0, 0, 0),
      v(2, 0, 0),
      v(2, 0.2, 0),
      v(0, 0.2, 0),
      v(0, 0, 1),
      v(2, 0, 1),
      v(2, 0.2, 1),
      v(0, 0.2, 1),
    ],
    faces: [
      { loop: [0, 3, 2, 1], holes: [] }, // bottom
      { loop: [4, 5, 6, 7], holes: [] }, // top
      { loop: [0, 1, 5, 4], holes: [] }, // front (y = 0)
      { loop: [1, 2, 6, 5], holes: [] }, // x = 2
      { loop: [2, 3, 7, 6], holes: [] }, // back (y = 0.2)
      { loop: [3, 0, 4, 7], holes: [] }, // x = 0
    ],
  };
}

test("a vertical cut drawn on the shrunk front face lands on the real one", () => {
  const mesh = makeWall();
  // Shrunk display: front face 10 mm inward, top 5 mm lower.
  const drawn = [v(1, 0.01, 0), v(1, 0.01, 0.995)];
  assert.equal(splitMesh3dFaceDetailed(mesh, drawn), null);

  const snapped = snapPathOntoMesh3dFace(mesh, drawn);
  assert.equal(snapped.faceIndex, 2);
  nearV(snapped.points[0], v(1, 0, 0));
  nearV(snapped.points[1], v(1, 0, 1));

  const split = splitMesh3dFaceDetailed(mesh, snapped.points, {
    faceIndices: [snapped.faceIndex],
  });
  assert.ok(split);
  assert.equal(split.mesh.faces.length, 7);
});

test("a cut across the shrunk top face lands on the real top", () => {
  const mesh = makeWall();
  const drawn = [v(0.5, 0.01, 0.995), v(0.5, 0.19, 0.995)];
  const snapped = snapPathOntoMesh3dFace(mesh, drawn);
  assert.equal(snapped.faceIndex, 1);
  nearV(snapped.points[0], v(0.5, 0, 1));
  nearV(snapped.points[1], v(0.5, 0.2, 1));
  assert.ok(
    splitMesh3dFaceDetailed(mesh, snapped.points, {
      faceIndices: [snapped.faceIndex],
    })
  );
});

test("interior points are only projected, node ids are kept", () => {
  const mesh = makeWall();
  const drawn = [
    { ...v(0.5, 0.004, 0), nodeId: "a" },
    v(0.8, 0.004, 0.5),
    v(1.2, 0.004, 0.995),
  ];
  const snapped = snapPathOntoMesh3dFace(mesh, drawn);
  assert.equal(snapped.faceIndex, 2);
  assert.equal(snapped.points[0].nodeId, "a");
  nearV(snapped.points[1], v(0.8, 0, 0.5));
  nearV(snapped.points[2], v(1.2, 0, 1));
});

test("no face near the path → null", () => {
  const mesh = makeWall();
  // 5 cm in front of the wall.
  assert.equal(
    snapPathOntoMesh3dFace(mesh, [v(1, -0.05, 0), v(1, -0.05, 1)]),
    null
  );
  // A path along an edge (no point strictly inside a face).
  assert.equal(
    snapPathOntoMesh3dFace(mesh, [v(0.2, 0, 1), v(1.5, 0, 1)]),
    null
  );
  assert.equal(snapPathOntoMesh3dFace(null, [v(0, 0, 0)]), null);
});

test("thin band: the view ray keeps a cut across the shrunk top on the top", () => {
  // 8 mm band, displayed top at 3 mm (nearer the bottom plane).
  const band = makeWall();
  band.vertices = band.vertices.map((p) => v(p.x, p.y, p.z > 0 ? 0.008 : 0));
  const drawn = [v(0.5, 0.01, 0.003), v(0.5, 0.19, 0.003)];
  assert.equal(snapPathOntoMesh3dFace(band, drawn).faceIndex, 0);
  const snapped = snapPathOntoMesh3dFace(band, drawn, {
    rayDir: v(0, 0.3, -1),
  });
  assert.equal(snapped.faceIndex, 1);
  nearV(snapped.points[0], v(0.5, 0, 0.008));
});
